/**
 * Folding a duplicate report into the open report for its target.
 *
 * `ReportsService` keeps one row per open report and stores later reports in
 * that row's `detail`. The *first* reporter's words are the statement a
 * moderator acts on, so a later report is appended to them — replacing the
 * detail (which an earlier version did) loses the original complaint.
 *
 * Kept as a leaf module so it is unit-testable without booting Nest: the
 * service uses a constructor parameter property, which the test runner's
 * strip-only TypeScript mode cannot execute.
 */

/** The fields a report contributes to the stored detail. */
export interface ReportDetailInput {
  reason: string;
  detail?: string | undefined;
}

/** Stored `Report.detail` is unbounded text; the folded form stays bounded. */
export const MAX_FOLDED_DETAIL = 2_000;

/**
 * Return `existing` with `incoming` appended as a new line.
 *
 * - an empty or whitespace-only `existing` yields just the new line;
 * - a reason-only report contributes its reason;
 * - the result is truncated at {@link MAX_FOLDED_DETAIL} so one target cannot
 *   be used to grow a single row without limit.
 */
export function appendDetail(existing: string | null, incoming: ReportDetailInput): string {
  const reason = incoming.reason.trim();
  const detail = incoming.detail?.trim() ?? '';
  const addition = `Additional report — ${detail ? `${reason}: ${detail}` : reason}`;
  const kept = existing?.trim() ?? '';
  return (kept ? `${kept}\n${addition}` : addition).slice(0, MAX_FOLDED_DETAIL);
}
