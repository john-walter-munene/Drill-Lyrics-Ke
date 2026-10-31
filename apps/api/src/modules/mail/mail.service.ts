import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { buildReviewNotification, type ReviewNotification, type ReviewOutcome } from '@drillke/shared';
import { redactEmail } from '../../common/redact';
import { resolveSmtpSettings, type SmtpSettings } from './smtp-config';

/**
 * Outbound mail: review outcomes and account emails (password reset).
 *
 * Two providers, selected by `MAIL_PROVIDER`:
 *
 * - **`mock` (default).** Structured log line, no network, no SMTP account, no
 *   risk of mailing a real address from a development machine. This is what the
 *   tests and CI run, and what `docs/roadmap.md` Phase 2 means by "mock provider
 *   first".
 * - **`smtp`.** A real transport (`nodemailer`) to SES, Postmark, Mailgun, or a
 *   local MailHog. Configuration is validated at boot by `resolveSmtpSettings`;
 *   an unusable configuration **refuses to send** and logs the reason rather
 *   than accepting a reset request and dropping the link.
 *
 * Delivery failures must never fail the action that triggered them. A moderator
 * approving lyrics has done the important thing; a bounced email is a retry, not
 * a rollback. Every method here resolves to a result and never throws.
 */
export type MailProvider = 'mock' | 'smtp';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SendResult {
  delivered: boolean;
  provider: MailProvider;
  /** Why nothing was sent, when `delivered` is false. */
  skippedReason?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly provider: MailProvider = (process.env.MAIL_PROVIDER as MailProvider) === 'smtp' ? 'smtp' : 'mock';
  private readonly smtp: SmtpSettings | null;
  private readonly transporter: Transporter | null;
  /** Set when SMTP was requested but the settings are unusable. */
  private readonly configProblems: string[];

  constructor() {
    if (this.provider === 'mock') {
      this.smtp = null;
      this.transporter = null;
      this.configProblems = [];
      this.logger.log('Mail provider: mock (messages are logged, not sent).');
      return;
    }

    const resolved = resolveSmtpSettings();
    if (!resolved.settings) {
      this.smtp = null;
      this.transporter = null;
      this.configProblems = resolved.problems;
      // Loud at boot, not per-send: an operator should see this in the first
      // ten lines of the container log, not when a user reports a missing link.
      this.logger.error(`MAIL_PROVIDER=smtp is misconfigured:\n  - ${resolved.problems.join('\n  - ')}`);
      return;
    }

    this.smtp = resolved.settings;
    this.configProblems = [];
    this.transporter = nodemailer.createTransport({
      host: resolved.settings.host,
      port: resolved.settings.port,
      secure: resolved.settings.secure,
      ...(resolved.settings.user
        ? { auth: { user: resolved.settings.user, pass: resolved.settings.password } }
        : {}),
      ...(resolved.settings.allowInvalidCert ? { tls: { rejectUnauthorized: false } } : {}),
    });
    this.logger.log(
      `Mail provider: smtp (${resolved.settings.host}:${resolved.settings.port}, `
      + `${resolved.settings.secure ? 'implicit TLS' : 'STARTTLS'}).`,
    );
  }

  /**
   * Start-up self-check. Called once from `main.ts` so a bad host, port or
   * credential shows up at deploy time rather than at the first reset request.
   * Never throws and never blocks boot: a mailer that is briefly unreachable
   * must not take the API down.
   */
  async verify(): Promise<{ ok: boolean; detail: string }> {
    if (this.provider === 'mock') return { ok: true, detail: 'mock provider' };
    if (!this.transporter) return { ok: false, detail: this.configProblems.join('; ') };
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified.');
      return { ok: true, detail: 'connection verified' };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP connection check failed: ${detail}`);
      return { ok: false, detail };
    }
  }

  /** Which provider is active — for `/api/health` detail and tests. */
  get activeProvider(): MailProvider {
    return this.provider;
  }

  /** Send one message. Never throws. */
  async send(message: MailMessage): Promise<SendResult> {
    if (!message.to) return { delivered: false, provider: this.provider, skippedReason: 'no recipient address' };

    if (this.provider === 'smtp') {
      if (!this.transporter || !this.smtp) {
        return {
          delivered: false,
          provider: this.provider,
          skippedReason: `SMTP is misconfigured: ${this.configProblems.join('; ')}`,
        };
      }
      try {
        await this.transporter.sendMail({
          from: this.smtp.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        this.logger.log(`mail sent to=${redactEmail(message.to)} subject=${JSON.stringify(message.subject)}`);
        return { delivered: true, provider: 'smtp' };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(`mail failed to=${redactEmail(message.to)}: ${detail}`);
        return { delivered: false, provider: 'smtp', skippedReason: detail };
      }
    }

    // Structured and greppable: `docker compose logs api | grep review-mail`.
    this.logger.log(`review-mail to=${redactEmail(message.to)} subject=${JSON.stringify(message.subject)}`);
    this.logger.debug(`review-mail body:\n${message.text}`);
    return { delivered: true, provider: 'mock' };
  }

  /**
   * Build and send the notification for a review outcome.
   *
   * `recipient` is `null` for a guest submission; that is a skip, not an error.
   */
  async notifyReviewOutcome(params: {
    outcome: ReviewOutcome;
    recipient: string | null;
    songTitle: string;
    songUrl?: string;
    note?: string | null;
    submissionId: string;
    siteUrl: string;
    syncStatus?: 'synchronized' | 'unsynchronized';
  }): Promise<{ notification: ReviewNotification | null; result: SendResult }> {
    if (!params.recipient) {
      return { notification: null, result: { delivered: false, provider: this.provider, skippedReason: 'guest submission has no email address' } };
    }
    const notification = buildReviewNotification({
      outcome: params.outcome,
      songTitle: params.songTitle,
      ...(params.songUrl ? { songUrl: params.songUrl } : {}),
      note: params.note ?? null,
      submissionId: params.submissionId,
      siteUrl: params.siteUrl,
      ...(params.syncStatus ? { syncStatus: params.syncStatus } : {}),
    });
    const result = await this.send({ to: params.recipient, subject: notification.subject, text: notification.text });
    if (!result.delivered) {
      this.logger.warn(`review-mail not delivered to=${redactEmail(params.recipient)}: ${result.skippedReason}`);
    }
    return { notification, result };
  }
}
