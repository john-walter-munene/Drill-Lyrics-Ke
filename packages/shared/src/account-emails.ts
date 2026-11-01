/**
 * Account-lifecycle email templates: password reset and account deletion.
 *
 * Pure text, no transport and no network, for the same reason as
 * `review-notifications.ts`: the words are the part worth reviewing and testing,
 * and the transport must be swappable without changing what a user reads.
 *
 * Security rules these messages follow:
 *   - The reset link is the only credential in the message. No password, no
 *     partial hash, no "your password was …".
 *   - The message always says what to do if the request was not yours, and says
 *     plainly that ignoring it changes nothing.
 *   - It names the expiry, so a message found days later is obviously stale.
 */

export interface Notification {
  subject: string;
  text: string;
  /** One-line summary for a log line or UI toast. */
  summary: string;
}

/** How long a reset link stays valid. The token row carries the same value. */
export const PASSWORD_RESET_TTL_MINUTES = 60;

export interface PasswordResetInput {
  /** Display name, so the greeting is not "Dear user". */
  displayName: string;
  /** Absolute URL including the token. */
  resetUrl: string;
  siteUrl: string;
  ttlMinutes?: number;
}

/**
 * The password-reset email.
 *
 * Written to be safe when forwarded: no email address of the user, no
 * account-specific detail beyond the display name they chose.
 */
export function buildPasswordResetEmail(input: PasswordResetInput): Notification {
  const name = input.displayName.trim() || 'there';
  const ttl = input.ttlMinutes ?? PASSWORD_RESET_TTL_MINUTES;
  return {
    subject: 'Reset your DrillKe password',
    summary: `Password reset link sent (valid ${ttl} minutes).`,
    text: [
      `Hi ${name},`,
      '',
      'Someone asked to reset the password for your DrillKe account. If that was you, open this link to choose a new one:',
      '',
      input.resetUrl,
      '',
      `The link works once and expires in ${ttl} minutes.`,
      '',
      'If you did not ask for this, you can ignore this message. Your current password still works and nothing has changed.',
      '',
      `— DrillKe · ${input.siteUrl}`,
    ].join('\n'),
  };
}

export interface AccountDeletedInput {
  displayName: string;
  siteUrl: string;
  /** How many published contributions stay credited by name. */
  creditedContributions: number;
}

/**
 * Confirmation after an account is deleted.
 *
 * Deliberately explicit about what is kept: published lyrics stay in the
 * catalogue (they are the site), but the account, sessions and pending
 * submissions are gone. Saying so up front prevents a follow-up "you still have
 * my data" request.
 */
export function buildAccountDeletedEmail(input: AccountDeletedInput): Notification {
  const name = input.displayName.trim() || 'there';
  const credits = input.creditedContributions;
  return {
    subject: 'Your DrillKe account has been deleted',
    summary: 'Account deletion confirmed.',
    text: [
      `Hi ${name},`,
      '',
      'Your DrillKe account has been deleted. You have been signed out everywhere, and any submissions still awaiting review were withdrawn.',
      '',
      credits > 0
        ? `Published lyrics you contributed stay on the site${credits === 1 ? ' with your public credit' : ` with your public credit on ${credits} songs`} — they are part of the catalogue. Ask us if you would like that name removed too.`
        : 'Nothing of yours was published, so nothing with your name remains on the site.',
      '',
      'You can create a new account at any time; it will not be linked to the old one.',
      '',
      `— DrillKe · ${input.siteUrl}`,
    ].join('\n'),
  };
}

/** How long a confirmation link stays valid. */
export const EMAIL_CONFIRMATION_TTL_DAYS = 7;

export interface EmailConfirmationInput {
  displayName: string;
  confirmUrl: string;
  siteUrl: string;
  ttlDays?: number;
}

/**
 * The sign-up confirmation email.
 *
 * Deliberately low-pressure: in v1 an unconfirmed account can still browse and
 * contribute, so the message asks rather than demands. Saying that plainly means
 * a user who never confirms is not left wondering whether their submission
 * disappeared.
 */
export function buildEmailConfirmationEmail(input: EmailConfirmationInput): Notification {
  const name = input.displayName.trim() || 'there';
  const days = input.ttlDays ?? EMAIL_CONFIRMATION_TTL_DAYS;
  return {
    subject: 'Confirm your DrillKe email',
    summary: `Confirmation link sent (valid ${days} days).`,
    text: [
      `Hi ${name},`,
      '',
      'Thanks for joining DrillKe. Confirm this address so we can reach you about your lyrics contributions:',
      '',
      input.confirmUrl,
      '',
      `The link works once and expires in ${days} days.`,
      '',
      'You can keep browsing and submitting lyrics without confirming. Confirming just means review outcomes reach you, and it helps us keep spam out of the review queue.',
      '',
      'If you did not create an account, ignore this message and nothing will happen.',
      '',
      `— DrillKe · ${input.siteUrl}`,
    ].join('\n'),
  };
}
