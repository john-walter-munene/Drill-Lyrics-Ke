'use client';

import { useEffect, useRef, useState } from 'react';
import { confirmEmail } from '../../../api';

type State = 'working' | 'confirmed' | 'already' | 'invalid';

/**
 * Spends the confirmation token once, on mount.
 *
 * The `ran` ref is not decoration: React 19 StrictMode mounts effects twice in
 * development, and without the guard the page would fire two POSTs — the second
 * would find the token already spent and could flash an "invalid" message over
 * a successful confirmation.
 *
 * The request runs in an effect rather than a server component because the
 * endpoint is a POST (it changes state) and the page must stay cacheable-free
 * and client-driven, like the reset flow.
 */
export default function ConfirmEmail({ token }: { token: string }) {
  const [state, setState] = useState<State>('working');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const result = await confirmEmail(token);
      if (!result.ok) {
        // The API's wording is generic on purpose (invalid / expired / used),
        // so the page shows the list of what to do rather than the raw error.
        setState('invalid');
        return;
      }
      setState(result.data.status === 'already_confirmed' ? 'already' : 'confirmed');
    })();
  }, [token]);

  if (state === 'working') {
    return <p className="muted" role="status">Confirming your email…</p>;
  }

  if (state === 'invalid') {
    return (
      <div className="panel" role="alert">
        <p>This confirmation link is invalid, has expired, or has already been used.</p>
        <p className="muted">
          You can still browse and contribute. Sign in and use <strong>Resend confirmation</strong> on
          your account page to get a fresh link.
        </p>
      </div>
    );
  }

  return (
    <div className="panel" role="status">
      <p>{state === 'already' ? 'This email was already confirmed. You are all set.' : 'Email confirmed — thank you.'}</p>
      <p className="muted">
        Review outcomes on your lyric submissions will now reach this address.
      </p>
    </div>
  );
}
