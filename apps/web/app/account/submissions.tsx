'use client';

import { useEffect, useState } from 'react';
import { apiRequest, browserGet } from '../../api';
import AccountSettings from './AccountSettings';

/** One row of `GET /api/lyrics/submissions/mine` (`docs/api.md`). */
interface MySubmission {
  id: string;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
  song: { title: string; slug: string };
}

/**
 * The signed-in contributor's submission history.
 *
 * A `changes_requested` or `rejected` row shows the reviewer's note, because
 * that note is the only thing the contributor can act on. Guests are sent to
 * sign in rather than shown an empty list they cannot fill.
 */
export default function AccountSubmissions() {
  const [items, setItems] = useState<MySubmission[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    void (async () => {
      const session = await browserGet<{ user: { displayName: string } }>('/api/auth/me');
      if (!session?.user) {
        window.location.assign('/sign-in');
        return;
      }
      setName(session.user.displayName);
      const list = await apiRequest<{ items: MySubmission[] }>('GET', '/api/lyrics/submissions/mine');
      if (list.ok) setItems(list.data.items);
    })();
  }, []);

  return (
    <>
      <h1>{name ? `Hi, ${name}` : 'Your account'}</h1>
      <h2>Your lyric submissions</h2>
      {items.length ? (
        items.map((item) => (
          <article className="panel" key={item.id}>
            <strong>{item.song.title}</strong>
            <p>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</p>
            {item.reviewNote ? <p>{item.reviewNote}</p> : null}
          </article>
        ))
      ) : (
        <p className="muted">
          No submissions yet. Your listening and lyrics contributions are open to everyone.
        </p>
      )}

      <h2>Account settings</h2>
      <AccountSettings />
    </>
  );
}
