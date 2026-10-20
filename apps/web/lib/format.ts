/** Small formatting helpers shared by pages. Keep them pure and dependency-free. */

/** Milliseconds → `m:ss` for track durations, or `—` when unknown. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** ISO date → human date, e.g. "14 Mar 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** ISO date-time → "Sat 14 Nov 2026, 20:00" (Nairobi time). */
export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  });
}
