import { SESSION_COOKIE } from '../../common/session-auth.guard';

/**
 * Session cookie header values, and the public site origin used in emails.
 *
 * Kept out of the controller so the three places that clear the cookie (sign
 * out, password reset, account deletion) cannot drift apart — a cookie cleared
 * without `Secure` in production is still sent, and a cookie cleared with the
 * wrong `Path` is not cleared at all.
 */

/** Used only when `NEXT_PUBLIC_SITE_URL` is unset (local runs, tests). */
export const SITE_URL_FALLBACK = 'http://localhost:3000';

/** Origin for links in outgoing mail. No trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? SITE_URL_FALLBACK).replace(/\/+$/, '');
}

/** Attributes a cookie must carry to be sent on future requests. */
function attributes(): string {
  return `Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

/** Set or refresh the session cookie. */
export function sessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${token}; ${attributes()}; Max-Age=${maxAge}`;
}

/** Expire the session cookie now, with the same attributes that set it. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${attributes()}; Max-Age=0`;
}
