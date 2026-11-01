/**
 * Review-outcome notification templates.
 *
 * Pure text only: no transport, no network, no database. `docs/roadmap.md`
 * Phase 2 asks for "notifications on review outcome (email, mock provider
 * first)", so the *content* is the part worth getting right and testing now;
 * swapping the mock transport for a real provider later must not change a
 * single word a contributor reads.
 *
 * Rules these messages follow, from `product.md`:
 *   - honest about state (`principle 4`): "published" only when it is;
 *   - never promise payment for a contribution (`§4.1`);
 *   - never leak reviewer-only detail to the contributor — a rejection says what
 *     to fix, not who reviewed it or what the reviewer wrote privately.
 */

/** Outcomes that notify the contributor. Approval and unpublish are separate. */
export type ReviewOutcome = 'approved' | 'changes_requested' | 'rejected';

export interface ReviewNotificationInput {
  outcome: ReviewOutcome;
  /** Song the submission was for, as the contributor saw it. */
  songTitle: string;
  /** Public URL of the song page, if the song is published. */
  songUrl?: string;
  /** Reviewer's note, shown verbatim for `changes_requested` and `rejected`. */
  note?: string | null;
  /** Reference shown to the contributor when they submitted. */
  submissionId: string;
  /** Site origin, so links work from a mail client. */
  siteUrl: string;
  /** Whether the published version is synchronized (approval only). */
  syncStatus?: 'synchronized' | 'unsynchronized';
}

export interface ReviewNotification {
  subject: string;
  text: string;
  /** One-line summary for a UI toast or log line. */
  summary: string;
}

/**
 * Build the subject and body for one outcome.
 *
 * Deterministic: the same input always produces the same text, which is what
 * lets the mock transport assert on it and what makes the e2e test stable.
 */
export function buildReviewNotification(input: ReviewNotificationInput): ReviewNotification {
  const song = input.songTitle.trim() || 'a song';
  const note = (input.note ?? '').trim();

  if (input.outcome === 'approved') {
    const syncLine = input.syncStatus === 'synchronized'
      ? 'The lyrics are synchronized, so they highlight as the track plays.'
      : 'The lyrics are readable but not yet synchronized — a reviewer will add timings.';
    return {
      subject: `Your lyrics for “${song}” are live`,
      summary: `Published lyrics for “${song}”.`,
      text: [
        `Thanks — your lyrics for “${song}” have been reviewed and published on DrillKe.`,
        '',
        syncLine,
        '',
        input.songUrl ? `Read them here: ${input.songUrl}` : `Open the site: ${input.siteUrl}`,
        '',
        `Reference: ${input.submissionId}`,
        '',
        'You can keep contributing any time. Credit is recognition, not payment.',
      ].join('\n'),
    };
  }

  if (input.outcome === 'changes_requested') {
    return {
      subject: `Changes requested for your lyrics for “${song}”`,
      summary: `Reviewer asked for changes on “${song}”.`,
      text: [
        `A reviewer looked at your lyrics for “${song}” and asked for changes before it can be published.`,
        '',
        note ? `What to change:\n${note}` : 'Open the site to see what the reviewer asked for.',
        '',
        `Reference: ${input.submissionId}`,
        '',
        'Your submission is still in the queue — nothing has been discarded.',
      ].join('\n'),
    };
  }

  return {
    subject: `Your lyrics for “${song}” were not accepted`,
    summary: `Rejected lyrics for “${song}”.`,
    text: [
      `Thanks for taking the time to submit lyrics for “${song}”. A reviewer was not able to publish this version.`,
      '',
      note ? `Reason:\n${note}` : 'No reason was recorded.',
      '',
      `Reference: ${input.submissionId}`,
      '',
      'If you believe this is a mistake, reply to this message with the reference above.',
    ].join('\n'),
  };
}

/**
 * Whether a review action notifies the contributor.
 *
 * Only an account-linked submission has an address to notify. A guest
 * submission has no account and no stored email (`docs/architecture.md` §4), so
 * it is skipped deliberately rather than silently dropped — the caller records
 * that in the audit log.
 */
export function shouldNotify(submission: { userId?: string | null; email?: string | null }): boolean {
  return Boolean(submission.userId && submission.email);
}
