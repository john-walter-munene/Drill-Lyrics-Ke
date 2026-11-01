import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { buildAccountDeletedEmail, buildEmailConfirmationEmail, buildPasswordResetEmail } from '@drillke/shared';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password';
import {
  CONFIRM_TOKEN_TTL_MS,
  buildConfirmUrl,
  buildResetUrl,
  createResetToken,
  hashResetToken,
  isTokenUsable,
  looksLikeResetToken,
  RESET_TOKEN_TTL_MS,
} from './reset-token';
import { PrismaService } from '../../prisma.service';
import { SESSION_JWT_SECRET } from './jwt-secret';
import { siteUrl } from './session-cookie';

const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
/** A session untouched for this long is dead, whatever the JWT says. */
const INACTIVITY_MS = 14 * 24 * 60 * 60 * 1000;
/** Oldest untouched reset links kept for audit; anything older is pruned. */
const RESET_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) { }

  async signUp(dto: { email: string; password: string; displayName: string }) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('An account with this email already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName.trim(),
        passwordHash: await hashPassword(dto.password),
        role: 'member',
      },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });
    // Confirmation is sent, not required: the account works immediately. A mail
    // failure must not turn a successful sign-up into an error.
    void this.sendConfirmation(user.id, siteUrl());
    return { user, ...(await this.createSession(user.id)) };
  }

  /**
   * Is this token a live session?
   *
   * Used by sign-in to prove the credential it just issued actually works, and
   * by the API to accept `Authorization: Bearer` when a browser refuses the
   * cookie. Same rules as `JwtStrategy.validate`, in one place, so a session
   * that passes here cannot be one the guard rejects.
   */
  async verifySessionToken(token: string) {
    const now = Date.now();
    let payload: { sub?: string; sid?: string };
    try {
      payload = jwt.verify(token, SESSION_JWT_SECRET) as { sub?: string; sid?: string };
    } catch {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    if (!payload.sub || !payload.sid) throw new UnauthorizedException('Your session has ended. Sign in again.');
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { id: true, email: true, displayName: true, role: true, createdAt: true } } },
    });
    if (!session || session.userId !== payload.sub || session.expiresAt.getTime() <= now
      || session.lastActivityAt.getTime() <= now - INACTIVITY_MS) {
      throw new UnauthorizedException('Your session has ended. Sign in again.');
    }
    return { ...session.user, sessionId: session.id };
  }

  // --- Email confirmation -----------------------------------------------------

  /**
   * Issue (or re-issue) a confirmation link. Always resolves; never throws.
   *
   * Re-issuing revokes any outstanding link, so the newest email is always the
   * one that works — the same rule password reset follows, and for the same
   * reason: an old forwarded copy should not still be live.
   */
  async sendConfirmation(userId: string, siteUrlValue: string): Promise<{ sent: boolean }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, displayName: true, emailVerifiedAt: true },
      });
      if (!user) return { sent: false };
      if (user.emailVerifiedAt) return { sent: false };

      const token = createResetToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONFIRM_TOKEN_TTL_MS);
      await this.prisma.$transaction(async (tx) => {
        await tx.emailConfirmationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
        await tx.emailConfirmationToken.create({ data: { userId, tokenHash: hashResetToken(token), expiresAt } });
      });

      const message = buildEmailConfirmationEmail({
        displayName: user.displayName,
        confirmUrl: buildConfirmUrl(siteUrlValue, token),
        siteUrl: siteUrlValue.replace(/\/+$/, ''),
      });
      const result = await this.mail.send({ to: user.email, subject: message.subject, text: message.text });
      if (!result.delivered) this.logger.warn(`Confirmation mail not delivered: ${result.skippedReason}`);
      return { sent: result.delivered };
    } catch (error) {
      this.logger.error(`Could not send a confirmation link: ${error instanceof Error ? error.message : String(error)}`);
      return { sent: false };
    }
  }

  /** Confirmation state for the account page. */
  async confirmationStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, email: true },
    });
    if (!user) throw new UnauthorizedException('Sign in to continue');
    return { verified: Boolean(user.emailVerifiedAt), email: user.email, verifiedAt: user.emailVerifiedAt };
  }

  /**
   * Spend a confirmation link.
   *
   * Idempotent on purpose: opening the link a second time reports `already
   * confirmed` rather than an error, because a user who clicked twice has done
   * nothing wrong and needs no action.
   */
  async confirmEmail(token: string) {
    if (!looksLikeResetToken(token)) throw new BadRequestException('This confirmation link is invalid or has expired.');
    const row = await this.prisma.emailConfirmationToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!row) throw new BadRequestException('This confirmation link is invalid or has expired.');

    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { emailVerifiedAt: true } });
    if (user?.emailVerifiedAt) return { ok: true, status: 'already_confirmed' as const };
    if (!isTokenUsable(row)) throw new BadRequestException('This confirmation link is invalid or has expired.');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const spent = await tx.emailConfirmationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (spent.count === 0) return;
      await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } });
      await tx.auditLog.create({
        data: { actorId: row.userId, action: 'account.email_confirmed', entity: 'user', entityId: row.userId },
      });
    });
    return { ok: true, status: 'confirmed' as const };
  }

  async validateCredentials(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!await verifyPassword(password, user?.passwordHash ?? null) || !user) return null;
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt };
  }

  async signIn(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, role: true, createdAt: true } });
    if (!user) throw new UnauthorizedException();
    return { user, ...(await this.createSession(user.id)) };
  }

  async signOut(sessionId?: string) {
    if (sessionId) await this.prisma.session.deleteMany({ where: { id: sessionId } });
    return { ok: true };
  }

  me(user: { id: string; email: string; displayName: string; role: string; createdAt?: Date } | undefined) {
    if (!user) throw new UnauthorizedException('Sign in to continue');
    return { user };
  }

  // --- Password reset ---------------------------------------------------------

  /**
   * Issue a reset link for `email`.
   *
   * **Always reports success**, whether or not the address has an account. An
   * endpoint that says "no such account" is an account-enumeration oracle: it
   * lets anyone test which emails are registered. The caller (and the UI) get a
   * neutral message either way, and the difference exists only in the logs.
   *
   * Only the newest link is valid at a time: issuing one revokes every
   * outstanding token for the user, so a second request cannot leave an older
   * email with a working link.
   */
  async requestPasswordReset(emailInput: string, siteUrl: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      this.logger.log('Password reset requested for an address with no account; no mail sent.');
      return { accepted: true };
    }

    const token = createResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      // Invalidate outstanding links, then issue the new one.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: 'account.password_reset_requested', entity: 'user', entityId: user.id },
      });
    });

    // Prune rows well past use so the table cannot grow without bound. The same
    // opportunistic cleanup the session table uses — no worker needed.
    await this.prisma.passwordResetToken.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - RESET_TOKEN_RETENTION_MS) } },
    });

    const message = buildPasswordResetEmail({
      displayName: user.displayName,
      resetUrl: buildResetUrl(siteUrl, token),
      siteUrl: siteUrl.replace(/\/+$/, ''),
    });
    const result = await this.mail.send({ to: user.email, subject: message.subject, text: message.text });
    if (!result.delivered) {
      // Still `accepted: true` to the caller — telling the client whether
      // delivery failed would leak that the account exists.
      this.logger.error(`Password reset mail was not delivered: ${result.skippedReason}`);
    }
    return { accepted: true };
  }

  /**
   * Check a link without spending it, so the reset page can say "this link has
   * expired" before the user types a new password.
   */
  async checkResetToken(token: string) {
    const row = await this.findUsableToken(token);
    return { valid: Boolean(row) };
  }

  /**
   * Complete a reset: verify the link, set the new password, spend the token and
   * revoke **every** session.
   *
   * Revoking all sessions is the point of a reset: if the reason for resetting
   * is that someone else had the account, leaving their session alive would
   * defeat it entirely.
   */
  async completePasswordReset(token: string, newPassword: string) {
    const row = await this.findUsableToken(token);
    if (!row) throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Conditional update: if another request spent the token between our read
      // and here, `count` is 0 and we must not reset a password with it.
      const spent = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: now },
      });
      if (spent.count === 0) throw new BadRequestException('This reset link has already been used. Request a new one.');

      await tx.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(newPassword) } });
      await tx.session.deleteMany({ where: { userId: row.userId } });
      await tx.auditLog.create({
        data: { actorId: row.userId, action: 'account.password_reset_completed', entity: 'user', entityId: row.userId },
      });
    });

    return { ok: true };
  }

  private async findUsableToken(token: string) {
    if (!looksLikeResetToken(token)) return null;
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
    if (!row || !isTokenUsable(row)) return null;
    return row;
  }

  // --- Account data export ----------------------------------------------------

  /**
   * Everything the site holds about this account, as one JSON document.
   *
   * Required by the privacy page's promise ("access or deletion") and by GDPR-
   * style rules. What is deliberately **excluded**, and why:
   *
   *   - `passwordHash` and reset/confirmation token hashes: they are credentials,
   *     not the user's data to read, and exporting them would put a credential
   *     in a file that ends up in a Downloads folder.
   *   - Other users' names or emails: a report the user filed includes the target
   *     ID but not someone else's personal data.
   *
   * The export is built from the user's own rows only, so it cannot leak another
   * account's data even if the select grows later.
   */
  async exportAccountData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('Sign in to continue');

    const [submissions, reports, sessions] = await Promise.all([
      this.prisma.lyricsSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          markdown: true,
          note: true,
          creditPublicly: true,
          contributorName: true,
          reviewNote: true,
          reviewedAt: true,
          createdAt: true,
          song: { select: { title: true, slug: true } },
        },
      }),
      // Reports are the user's own filings; the target is referenced, not expanded.
      this.prisma.report.findMany({
        where: { reporterId: userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, targetType: true, targetId: true, reason: true, detail: true, status: true, createdAt: true },
      }),
      this.prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, expiresAt: true, lastActivityAt: true },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      about: 'This file contains everything DrillKe stores about your account. Passwords and security tokens are never included.',
      account: user,
      lyricSubmissions: submissions,
      reportsFiled: reports,
      activeSessions: sessions,
    };
  }

  // --- Account deletion -------------------------------------------------------

  /**
   * Delete the signed-in user's account.
   *
   * What happens, and why:
   *   - **Requires the password.** A borrowed session must not be able to
   *     destroy an account; re-authentication is the usual guard for this.
   *   - **Pending submissions are deleted**, because their address is on the
   *     account and nothing of value is lost — they were never public.
   *   - **Published contributions are kept**, as `LyricsSubmission.user` is
   *     `onDelete: SetNull`. They are the catalogue, and removing them would
   *     delete other people's work too. A `creditPublicly` row keeps its
   *     `contributorName` string; that is a public byline the contributor
   *     asked for, and the confirmation mail tells them how to have it removed.
   *   - **Sessions and reset tokens cascade** via the schema, so every device is
   *     signed out and no outstanding link survives.
   *
   * The mail is sent *before* deletion (the address is the account's, so it is
   * gone afterwards) and never fails the action.
   */
  async deleteAccount(userId: string, password: string, siteUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('Sign in to continue');
    if (!user.passwordHash || !await verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('That password is not correct.');
    }

    const credited = await this.prisma.lyricsSubmission.count({
      where: { userId, status: { in: ['published', 'approved'] }, creditPublicly: true },
    });

    const message = buildAccountDeletedEmail({
      displayName: user.displayName,
      siteUrl: siteUrl.replace(/\/+$/, ''),
      creditedContributions: credited,
    });
    const delivery = await this.mail.send({ to: user.email, subject: message.subject, text: message.text });

    await this.prisma.$transaction(async (tx) => {
      // Written before the user row goes: `actorId` would otherwise have to be
      // dropped, and a deletion with no actor is indistinguishable from a purge.
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'account.deleted',
          entity: 'user',
          entityId: user.id,
          meta: {
            creditedContributions: credited,
            confirmationMail: delivery.delivered ? 'sent' : `not sent: ${delivery.skippedReason}`,
          },
        },
      });
      await tx.lyricsSubmission.deleteMany({
        where: { userId: user.id, status: { notIn: ['published', 'approved'] } },
      });
      // Reports are attributed to the account that filed them; once the account
      // is gone the report cannot be acted on or asked about, so it goes too.
      await tx.report.deleteMany({ where: { reporterId: user.id } });
      // Cascades sessions, reset tokens and confirmation tokens (onDelete: Cascade).
      await tx.user.delete({ where: { id: user.id } });
    });

    return { ok: true };
  }

  private async createSession(userId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    const session = await this.prisma.session.create({ data: { userId, expiresAt, lastActivityAt: now } });
    const token = jwt.sign({ sub: userId, sid: session.id }, SESSION_JWT_SECRET, { expiresIn: '14d' });
    // Remove expired rows opportunistically rather than requiring a worker.
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { token, expiresAt, sessionId: session.id };
  }
}
