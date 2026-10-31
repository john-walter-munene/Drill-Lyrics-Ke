/**
 * Log-safety helpers.
 *
 * `product.md` §9 keeps analytics free of PII, and the same restraint applies to
 * server logs: an email address in a log line is personal data that outlives the
 * request that produced it. Operators still need to debug delivery, so the
 * domain is kept and the local part is masked.
 */

/** `someone@example.com` → `s***@example.com`. Never throws on junk input. */
export function redactEmail(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}
