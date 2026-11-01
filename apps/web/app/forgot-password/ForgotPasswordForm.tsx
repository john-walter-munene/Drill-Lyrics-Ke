'use client';

import { useState, type FormEvent } from 'react';
import { requestPasswordReset } from '../../api';

/**
 * Request a reset link.
 *
 * The confirmation text is deliberately identical whether or not the address
 * has an account — the API does the same, and the UI must not undo it by
 * revealing the difference. `role="status"` announces it without stealing focus.
 */
export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    setBusy(true);
    setError('');
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) {
      setError(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="panel" role="status">
        <p>
          If an account exists for that address, a reset link is on its way. It works once and
          expires in an hour.
        </p>
        <p className="muted">
          Nothing arrived? Check spam, then <a href="/forgot-password">try again</a> — a new link
          replaces any earlier one.
        </p>
      </div>
    );
  }

  return (
    // `action` is a pre-hydration guard, not a route: without it a fast click
    // before React attaches would send an email address as `?email=…` in a GET.
    <form onSubmit={submit} action="javascript:void 0" autoComplete="on" className="panel" style={{ display: 'grid', gap: '.8rem', margin: '1rem 0' }}>
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <button className="btn btn--primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
      {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
    </form>
  );
}
