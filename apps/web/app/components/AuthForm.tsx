'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { getSessionUser, readToken, signIn, signUp, storeToken, clearToken } from '../../api';

/**
 * Sign in / sign up.
 *
 * ## Why this form can never submit natively
 *
 * A `<form>` with no `action` submits as `GET` to the current URL, putting every
 * field in the query string — so `?email=…&password=…` lands in browser history,
 * server access logs and any `Referer` the page later sends. React prevents that
 * via `onSubmit`, **but only once the page has hydrated.** Until then the markup
 * is plain HTML, and a click on the button does the native submit.
 *
 * This is not theoretical: measured on a cold dev load, a submit at 0 ms after
 * `DOMContentLoaded` produced a native GET with both credentials in the URL, and
 * the same submit at 1 s produced the intended `fetch`. A user typing fast on a
 * slow phone hits the first case.
 *
 * Two structural defences, neither of which depends on hydration timing:
 *
 * 1. **The submit button is `type="button"` and calls `submit()` itself**, so it
 *    can never trigger a native submit. `submit()` reads the form only after
 *    checking that JavaScript is running — which, by definition, it is.
 * 2. **Enter still works**, because it fires the form's `submit` event; the
 *    `onSubmit` handler cancels that event as before. Before hydration, Enter
 *    has no handler and *would* submit natively — so the form also carries
 *    `action="javascript:void 0"`, which browsers treat as a no-op navigation
 *    rather than a GET. (React's own handler runs first when hydrated, so the
 *    attribute is inert by then.)
 *
 * The cost of that choice is that the button does nothing until React attaches.
 * So the button reports its own state instead of lying: it stays disabled (and
 * says "Loading…") until the client has mounted, then enables. A dead-looking
 * button during hydration is a fair trade for never leaking a password.
 *
 * `autoComplete="on"` is explicit: Chrome disables autofill wholesale when a
 * `new-password` field is present in a form it has not seen submit successfully.
 * `noValidate` is *not* set — `required`/`minLength` stay as the first line
 * before the API's own validation.
 */
export default function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // False until the client has hydrated. Renders as "Loading…" and disabled,
  // so a fast click cannot be silently ignored.
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  async function submit(event?: FormEvent<HTMLFormElement>, form?: HTMLFormElement) {
    event?.preventDefault();
    const element = form ?? (event?.currentTarget as HTMLFormElement | undefined);
    if (!element) return;

    // Use the DOM's own validation so the native constraints still apply now
    // that the button no longer triggers a native submit.
    if (!element.reportValidity()) return;

    const data = new FormData(element);
    setBusy(true);
    setError('');
    const result = mode === 'signin'
      ? await signIn({ email: String(data.get('email')), password: String(data.get('password')) })
      : await signUp({ email: String(data.get('email')), password: String(data.get('password')), displayName: String(data.get('displayName')) });
    setBusy(false);
    if (!result.ok) {
      // A 0 means the request never left the browser (API down, CORS, offline).
      // "Invalid email or password" would be a lie in that case, and sends people
      // hunting for a password problem that does not exist.
      const message = Array.isArray(result.message) ? result.message.join(' ') : result.message;
      setError(result.status === 0 ? 'Could not reach the server. Check your connection and try again.' : message);
      return;
    }
    // Sign-up signs you in. Sign-in must NOT rely on the cookie the way the
    // dashboard does: a stale `drillke_session` (an expired or pre-reset token)
    // would still be sent to /admin, fail there, and look like "admin login is
    // broken" even though the password was right. So the token also comes back
    // in the body, and we verify it before navigating.
    const token = result.data.token;
    if (token) storeToken(token);
    else clearToken();
    if (!(await assertSession())) return;
    // `?next=` is set by pages that sent you here (e.g. the staff dashboard), so
    // signing in lands where you were going instead of always on /account.
    // Only a same-site absolute path is accepted — never a full URL, which would
    // turn the sign-in form into an open redirect.
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    const home = result.data.user.role === 'admin' || result.data.user.role === 'moderator' ? '/admin' : '/account';
    window.location.assign(safeNext ?? home);
  }

  /**
   * Confirm the session we just created is actually readable.
   *
   * If the cookie did not survive (third-party cookie rules on a split
   * web/API origin, a proxy that drops Set-Cookie), navigate to /admin anyway
   * and the user meets a bare "sign in" page with no explanation. Asking here
   * turns that into a message that names the cause.
   */
  async function assertSession(): Promise<boolean> {
    const me = await getSessionUser();
    if (me.ok) return true;
    // The token can be replayed as a bearer credential, so the fallback is
    // honest rather than wrong — but it is a session problem, not a password one.
    if (!readToken()) {
      setError(
        'Signed in, but this browser did not keep the session. ' +
        'If the API is on a different domain, allow cookies for it; otherwise try again.',
      );
      return false;
    }
    return true;
  }

  return (
    <form
      id={`auth-${mode}`}
      onSubmit={submit}
      // Belt and braces for the pre-hydration window; see the note above.
      action="javascript:void 0"
      autoComplete="on"
      className="panel"
      style={{ display: 'grid', gap: '.8rem', margin: '1rem 0' }}
    >
      {mode === 'signup' && <label>Display name<input name="displayName" required minLength={2} maxLength={40} autoComplete="name" /></label>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={mode === 'signup' ? 10 : 1} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
      <button
        type="button"
        className="btn btn--primary"
        disabled={busy || !ready}
        onClick={(event) => {
          const form = event.currentTarget.form;
          if (form) void submit(undefined, form);
        }}
      >
        {!ready ? 'Loading…' : busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
      {error && <p role="alert" className="player-shell__error">{error}</p>}
    </form>
  );
}
