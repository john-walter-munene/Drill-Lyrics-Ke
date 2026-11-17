/**
 * The browser's device token.
 *
 * Live, a vote is bound to one device per account: the first device that votes
 * registers, and a second device is refused. The token is a random id kept in
 * localStorage — it is not a fingerprint, so it does not follow the person
 * across browsers, and it is never sent anywhere except as a hash on a vote.
 *
 * It is deliberately best-effort. A browser in private mode, or one that blocks
 * storage, gets `null` and the vote is still accepted; the API only applies the
 * device rule when a token is actually presented.
 */
const DEVICE_KEY = 'drillke.device';

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;

    const token =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_KEY, token);
    return token;
  } catch {
    return null;
  }
}
