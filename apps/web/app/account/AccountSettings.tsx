'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { deleteAccount, exportAccountData, getConfirmationStatus, resendConfirmation, signOut } from '../../api';

/**
 * Account settings: sign out everywhere, and delete the account.
 *
 * Deletion is the only destructive action a member has, so it is guarded twice
 * in the UI as it is on the server: the button stays disabled until the exact
 * confirmation phrase is typed, and the password is required in the request.
 * `docs/product.md` §4.2 promises nothing irreversible happens on a mis-click.
 *
 * What happens to content is stated up front, in the same words the
 * confirmation email uses — a user should not discover the rule afterwards.
 */
const CONFIRM_PHRASE = 'delete my account';

export default function AccountSettings() {
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Email confirmation state, and the two account-lifecycle actions.
  const [verified, setVerified] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [resendNote, setResendNote] = useState('');
  const [resending, setResending] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    void (async () => {
      const status = await getConfirmationStatus();
      if (!status) return;
      setVerified(status.verified);
      setEmail(status.email);
    })();
  }, []);

  async function handleResend() {
    setResending(true);
    setResendNote('');
    const result = await resendConfirmation();
    setResending(false);
    // The API answers `accepted` even when nothing was sent (already confirmed,
    // or `MAIL_PROVIDER=mock`), so the copy must not promise a delivery it
    // cannot observe — and must not reveal which of those it was.
    setResendNote(
      result.ok
        ? 'If this address still needs confirming, a new link is on its way. Check spam before asking again.'
        : 'Could not request a new link. Try again in a moment.',
    );
  }

  async function handleExport() {
    setExportNote('Preparing your file…');
    setExportError('');
    // The client fetches and saves the file itself; it reports the filename it
    // used, not the payload, so nothing large passes back through React state.
    const result = await exportAccountData();
    if (!result.ok) {
      setExportNote('');
      setExportError(result.message);
      return;
    }
    setExportNote(`Saved ${result.filename}. Open it in any text editor to read it.`);
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true);
    setError('');
    const result = await deleteAccount(password);
    setBusy(false);
    if (!result.ok) {
      const message = Array.isArray(result.message) ? result.message.join(' ') : result.message;
      setError(message);
      return;
    }
    // The account (and this session) is gone; there is nothing left to render.
    window.location.assign('/');
  }

  async function handleSignOut() {
    setSigningOut(true);
    // Best effort: the cookie is cleared locally by the API even if the call
    // fails, so a network blip must not strand the user on an account page.
    await signOut();
    window.location.assign('/');
  }

  return (
    <>
      <section className="panel" aria-labelledby="email-heading">
        <h2 id="email-heading" style={{ marginTop: 0 }}>Email</h2>
        {verified === null ? (
          <p className="muted">Checking your email status…</p>
        ) : verified ? (
          <p className="muted">
            <strong>{email}</strong> is confirmed. Review outcomes on your submissions reach this address.
          </p>
        ) : (
          <>
            <p className="muted">
              <strong>{email}</strong> is not confirmed yet. You can browse and submit lyrics without
              confirming — confirming just makes sure review outcomes reach you.
            </p>
            <button type="button" className="btn" disabled={resending} onClick={() => void handleResend()}>
              {resending ? 'Sending…' : 'Resend confirmation'}
            </button>
          </>
        )}
        {resendNote ? <p className="muted" role="status">{resendNote}</p> : null}
      </section>

      <section className="panel" aria-labelledby="session-heading" style={{ marginTop: '1rem' }}>
        <h2 id="session-heading" style={{ marginTop: 0 }}>Session</h2>
        <p className="muted">
          Signing out ends this session. To end sessions on other devices, change your password.
        </p>
        <p style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: 0 }}>
          <button type="button" className="btn" disabled={signingOut} onClick={() => void handleSignOut()}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          <a className="btn" href="/forgot-password">Change password</a>
        </p>
      </section>

      <section className="panel" aria-labelledby="export-heading" style={{ marginTop: '1rem' }}>
        <h2 id="export-heading" style={{ marginTop: 0 }}>Download your data</h2>
        <p className="muted">
          A JSON file with your account details, lyric submissions, reports you filed and active sessions.
          Passwords and security tokens are never included.
        </p>
        <button type="button" className="btn" onClick={() => void handleExport()}>Download my data</button>
        {exportNote ? <p className="muted" role="status">{exportNote}</p> : null}
        {exportError ? <p role="alert" className="player-shell__error">{exportError}</p> : null}
      </section>

      <section className="panel" aria-labelledby="delete-heading" style={{ marginTop: '1rem' }}>
        <h2 id="delete-heading" style={{ marginTop: 0 }}>Delete account</h2>
        <p className="muted">
          This cannot be undone. Your account is removed, you are signed out everywhere, and any
          submission still waiting for review is withdrawn.
        </p>
        <p className="muted">
          Lyrics that have already been published stay in the catalogue, because they are part of the
          site. If you opted into public credit, your name stays on them — get in touch and we will
          remove it.
        </p>

        {!expanded ? (
          <button type="button" className="btn" onClick={() => setExpanded(true)}>
            Delete my account…
          </button>
        ) : (
          // `action` is a pre-hydration guard: a submit before React attaches
          // would otherwise put the password in the URL as a GET.
          <form onSubmit={handleDelete} action="javascript:void 0" autoComplete="on" style={{ display: 'grid', gap: '.8rem', maxWidth: 420 }}>
            <label>
              Type <strong>{CONFIRM_PHRASE}</strong> to confirm
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                autoComplete="off"
                aria-describedby="delete-confirm-hint"
              />
            </label>
            <span id="delete-confirm-hint" className="visually-hidden">
              The delete button stays disabled until this matches exactly.
            </span>
            <label>
              Your password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || confirmText.trim().toLowerCase() !== CONFIRM_PHRASE}
              >
                {busy ? 'Deleting…' : 'Delete account permanently'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { setExpanded(false); setConfirmText(''); setError(''); }}
              >
                Cancel
              </button>
            </div>
            {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
          </form>
        )}
      </section>
    </>
  );
}
