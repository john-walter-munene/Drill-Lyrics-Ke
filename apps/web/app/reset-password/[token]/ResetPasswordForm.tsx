'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { checkResetToken, completePasswordReset } from '../../../api';

type TokenState = 'checking' | 'valid' | 'invalid';

/**
 * Complete a password reset.
 *
 * Three states, in this order, because each one is a different thing to tell the
 * user: checking (linking the token), usable (show the form), and unusable or
 * spent (send them to request a new link). The confirm field is client-side
 * only — the API takes one password, and a submitted-but-typo'd password should
 * never leave the browser.
 */
export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<TokenState>('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await checkResetToken(token);
      if (cancelled) return;
      // A network failure is not "invalid": saying so would send someone to
      // request a second link for a problem that is ours. Only an explicit
      // `valid: false` from the API counts as unusable.
      if (!result) {
        setState('valid');
        return;
      }
      setState(result.valid ? 'valid' : 'invalid');
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    setError('');

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    const result = await completePasswordReset(token, password);
    setBusy(false);
    if (!result.ok) {
      const message = Array.isArray(result.message) ? result.message.join(' ') : result.message;
      // An expired or spent link is a state change, not a form error.
      if (result.status === 400) setState('invalid');
      setError(message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="panel" role="status">
        <p>Your password has been changed. Every other device has been signed out.</p>
        <p className="muted">
          <a className="btn btn--primary" href="/sign-in">Sign in with your new password</a>
        </p>
      </div>
    );
  }

  if (state === 'checking') {
    return <p className="muted" role="status">Checking your link…</p>;
  }

  if (state === 'invalid') {
    return (
      <div className="panel" role="alert">
        <p>This reset link is invalid, has expired, or has already been used.</p>
        <p className="muted">
          Reset links work once and expire after an hour. Request a fresh one and use the newest
          email — an older link stops working when a newer one is sent.
        </p>
        <p><a className="btn" href="/forgot-password">Request a new link</a></p>
      </div>
    );
  }

  return (
    // `action` is a pre-hydration guard, not a route: a submit before React
    // attaches would otherwise put the new password in the URL as a GET.
    <form onSubmit={submit} action="javascript:void 0" autoComplete="on" className="panel" style={{ display: 'grid', gap: '.8rem', margin: '1rem 0' }}>
      <label>
        New password
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          aria-describedby="password-hint"
        />
      </label>
      <p id="password-hint" className="muted" style={{ margin: 0, fontSize: '.85rem' }}>
        At least 10 characters. A passphrase of a few words is easier to remember and harder to guess.
      </p>
      <label>
        Confirm new password
        <input name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
      </label>
      <button className="btn btn--primary" disabled={busy}>
        {busy ? 'Saving…' : 'Set new password'}
      </button>
      {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
    </form>
  );
}
