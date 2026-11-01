/**
 * SMTP settings, resolved from the environment and checked before boot.
 *
 * Kept out of `MailService` (and out of `common/config.ts`) so it can be unit
 * tested without a transport, a socket or Nest: this file only reads strings
 * and returns either settings or the list of reasons they are unusable.
 *
 * A half-configured mailer is worse than none — it accepts a password-reset
 * request and silently drops the link. So `collectSmtpProblems` is strict: a
 * provider of `smtp` with anything missing is a configuration error, and the
 * service refuses to pretend it can send.
 */

export interface SmtpSettings {
  host: string;
  port: number;
  /** `true` for implicit TLS (port 465), `false` to STARTTLS on 587/25. */
  secure: boolean;
  user?: string;
  password?: string;
  /** Envelope sender, e.g. `DrillKe <no-reply@drillke.com>`. */
  from: string;
  /** Optional: accept a self-signed certificate (local MailHog, staging). */
  allowInvalidCert: boolean;
}

/** Ports that speak TLS from the first byte. 587 and 25 negotiate STARTTLS. */
const IMPLICIT_TLS_PORTS = new Set([465]);

/**
 * Parse `SMTP_PORT`. Returns `null` for anything that is not a TCP port, so the
 * caller reports "invalid" rather than silently defaulting to 587.
 */
export function parseSmtpPort(value: string | undefined): number | null {
  if (!value || !value.trim()) return 587;
  const port = Number(value.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return port;
}

/**
 * Resolve settings, or explain why they cannot be used.
 *
 * Returns `{ settings }` when the environment describes a usable mailer and
 * `{ problems }` otherwise. Never throws.
 */
export function resolveSmtpSettings(
  env: NodeJS.ProcessEnv = process.env,
): { settings: SmtpSettings; problems: [] } | { settings: null; problems: string[] } {
  const problems: string[] = [];

  const host = (env.SMTP_HOST ?? '').trim();
  if (!host) problems.push('SMTP_HOST is required when MAIL_PROVIDER=smtp');

  const port = parseSmtpPort(env.SMTP_PORT);
  if (port == null) problems.push(`SMTP_PORT must be a number between 1 and 65535 (got "${env.SMTP_PORT}")`);

  const from = (env.MAIL_FROM ?? '').trim();
  // Deliberately loose: nodemailer accepts `Name <addr>` and bare addresses,
  // and a stricter regex here would reject valid forms before nodemailer sees
  // them. An address with no `@` is always a mistake, though.
  if (!from) problems.push('MAIL_FROM is required when MAIL_PROVIDER=smtp (e.g. "DrillKe <no-reply@drillke.com>")');
  else if (!from.includes('@')) problems.push(`MAIL_FROM does not look like an address: "${from}"`);

  const user = (env.SMTP_USER ?? '').trim();
  const password = env.SMTP_PASSWORD ?? '';
  // Either both or neither: a user without a password is a half-credential and
  // will fail at send time, which is exactly the failure this check exists for.
  if (user && !password) problems.push('SMTP_PASSWORD is required when SMTP_USER is set');
  if (!user && password) problems.push('SMTP_USER is required when SMTP_PASSWORD is set');

  if (problems.length > 0) return { settings: null, problems };

  const resolvedPort = port ?? 587;
  return {
    settings: {
      host,
      port: resolvedPort,
      // Honour an explicit SMTP_SECURE, otherwise infer from the port.
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : IMPLICIT_TLS_PORTS.has(resolvedPort),
      ...(user ? { user, password } : {}),
      from,
      allowInvalidCert: env.SMTP_ALLOW_INVALID_CERT === 'true',
    },
    problems: [],
  };
}
