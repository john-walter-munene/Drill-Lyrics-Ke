import { createHash, randomBytes } from 'node:crypto';

/**
 * Email-link tokens: generation, storage form, and the URL.
 *
 * Used for both password reset and email confirmation. The token travels in an
 * email; the database stores only its SHA-256. That is the whole security model
 * of this file, and it is why it is separate and pure:
 *
 *   - `randomBytes(32)` is 256 bits from the OS CSPRNG. A link is unguessable.
 *   - SHA-256 (not scrypt) is the right hash *here*: the input is already high
 *     entropy, so there is nothing to brute-force, and the lookup must be fast
 *     and exact. Password hashing is the one that must be slow.
 *   - The hash is base64url so it is a plain text column, no encoding surprises.
 *
 * The URL builders put the token in the **path**, not the query string: paths
 * are not sent in `Referer` headers to third-party resources in the way query
 * strings can be, and they do not end up in analytics page-URL fields.
 *
 * The two token types share functions but not tables (`PasswordResetToken` vs
 * `EmailConfirmationToken`), so a confirmation link can never be spent as a
 * password reset.
 */

/** Password reset is valid for this long; mirrors `PASSWORD_RESET_TTL_MINUTES`. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Confirmation links live longer: people open a sign-up email tomorrow. */
export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 bytes → 43 base64url characters. */
export function createResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The exact value stored in `PasswordResetToken.tokenHash`. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

/**
 * A basic shape check before hitting the database.
 *
 * Not a security boundary — the hash comparison is — but it lets the API answer
 * a malformed or truncated link with "this link is invalid" rather than running
 * a pointless query for every bot that probes the route.
 */
export function looksLikeResetToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The reset link a user clicks. */
export function buildResetUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/reset-password/${token}`;
}

/** The confirmation link a new account receives. */
export function buildConfirmUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/confirm-email/${token}`;
}

/** Whether a token row is still usable at `now`. */
export function isTokenUsable(
  row: { expiresAt: Date; usedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return row.usedAt === null && row.expiresAt.getTime() > now.getTime();
}
