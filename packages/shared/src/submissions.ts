/**
 * Who may resubmit a lyric submission, and in what state.
 *
 * A reviewer who asks for changes has told the contributor exactly what to fix.
 * Before this rule existed, the contributor could read that note on
 * `/account/submissions` and then had no way to act on it: the only write route
 * was `POST /api/lyrics/submissions`, which starts a brand-new submission and
 * loses the conversation. The note was a dead end.
 *
 * Pure and shared so the API (`409` rules) and the account page (which rows show
 * an Edit button) cannot drift apart.
 */

import type { SubmissionStatus } from './types.ts';

/**
 * Statuses a contributor may edit and send back for review.
 *
 * `changes_requested` is the whole point. `draft` is included because a
 * submission can be created in that state and must be completed by someone.
 * `rejected` is deliberately absent: `product.md` §5.3 treats rejection as the
 * end of that submission, and reopening it would make "rejected" mean
 * "pending, eventually". A rejected contributor can still submit afresh.
 */
export const RESUBMITTABLE_STATUSES = ['changes_requested', 'draft'] as const;
export type ResubmittableStatus = (typeof RESUBMITTABLE_STATUSES)[number];

export type ResubmitBlockedReason = 'not_owner' | 'wrong_status';

export type ResubmitEligibility =
  | { ok: true }
  | { ok: false; reason: ResubmitBlockedReason; message: string };

export interface ResubmitCandidate {
  /** The signed-in user's id, or null for a guest session. */
  userId: string | null | undefined;
  /** `LyricsSubmission.userId` — null for a guest-submitted row. */
  ownerId: string | null;
  status: SubmissionStatus | string;
}

/**
 * May this user resubmit this submission?
 *
 * Ownership is checked before status so a caller cannot learn that someone
 * else's submission is in `changes_requested` — the same reasoning as the
 * non-enumerable password-reset endpoint. A guest-owned row has no owner to
 * prove, so it is never resubmittable.
 */
export function checkResubmission(candidate: ResubmitCandidate): ResubmitEligibility {
  if (!candidate.userId) {
    return { ok: false, reason: 'not_owner', message: 'Sign in to edit your submission' };
  }
  if (candidate.ownerId !== candidate.userId) {
    // Covers both "not yours" and "submitted as a guest": neither has an owner
    // that matches the caller, and the response should not distinguish them.
    return { ok: false, reason: 'not_owner', message: 'Submission not found' };
  }
  if (!isResubmittable(candidate.status)) {
    return {
      ok: false,
      reason: 'wrong_status',
      message: `A submission that is ${humanStatus(candidate.status)} cannot be resubmitted`,
    };
  }
  return { ok: true };
}

export function isResubmittable(status: SubmissionStatus | string): status is ResubmittableStatus {
  return (RESUBMITTABLE_STATUSES as readonly string[]).includes(status);
}

/** `changes_requested` → "changes requested", for a sentence a person reads. */
export function humanStatus(status: SubmissionStatus | string): string {
  return status.replace(/_/g, ' ');
}

/**
 * What a resubmission sets on the row.
 *
 * The review fields are cleared rather than preserved: once the contributor has
 * acted, the old note describes text that no longer exists, and leaving it on a
 * `pending` row is how the queue shows a reviewer their own stale comment.
 * The row stays the same submission — same id, same history — rather than
 * becoming a new one.
 */
export function resubmissionUpdate(status: SubmissionStatus | string) {
  if (!isResubmittable(status)) {
    throw new Error(`Refusing to resubmit a submission that is ${status}`);
  }
  return {
    status: 'pending' as const,
    reviewNote: null,
    reviewerId: null,
    reviewedAt: null,
  };
}