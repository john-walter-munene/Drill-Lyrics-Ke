'use client';

import { useCallback, useEffect, useState } from 'react';
import { isResubmittable } from '@drillke/shared';
import { apiRequest, browserGet } from '../../api';
import AccountSettings from './AccountSettings';
import ResubmitPanel from './ResubmitPanel';

/** One row of `GET /api/lyrics/submissions/mine` (`docs/api.md`). */
interface MySubmission {
  id: string;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
  markdown: string;
  song: { title: string; slug: string };
}

/**
 * The signed-in contributor's submission history.
 *
 * A `changes_requested` row shows the reviewer's note **and** an editor, because
 * a note with no way to act on it is a dead end: before this, the contributor
 * had to start a brand-new submission and retype the whole document. Which rows
 * offer the editor is decided by the shared `isResubmittable` rule, so the page
 * and the API's `409` cannot disagree.
 *
 * Guests are sent to sign in rather than shown an empty list they cannot fill.
 */
export default function AccountSubmissions() {
  const [items, setItems] = useState<MySubmission[]>([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await apiRequest<{ items: MySubmission[] }>('GET', '/api/lyrics/submissions/mine');
    if (list.ok) setItems(list.data.items);
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await browserGet<{ user: { displayName: string } }>('/api/auth/me');
      if (!session?.user) {
        window.location.assign('/sign-in');
        return;
      }
      setName(session.user.displayName);
      await load();
    })();
  }, [load]);

  const onResubmitted = useCallback(async () => {
    setEditing(null);
    setNotice('Resent for review. The reviewer will see your update.');
    await load();
  }, [load]);

  return (
    <>
      <h1>{name ? `Hi, ${name}` : 'Your account'}</h1>
      <h2>Your lyric submissions</h2>
      {notice ? <p role="status" className="muted">{notice}</p> : null}
      {items.length ? (
        items.map((item) => (
          <article className="panel" key={item.id}>
            <strong>{item.song.title}</strong>
            <p>{item.status.replace(/_/g, ' ')} · {new Date(item.createdAt).toLocaleDateString()}</p>
            {item.reviewNote ? <p>{item.reviewNote}</p> : null}
            {isResubmittable(item.status) ? (
              editing === item.id ? (
                <ResubmitPanel
                  submissionId={item.id}
                  songTitle={item.song.title}
                  reviewNote={item.reviewNote ?? null}
                  initialMarkdown={item.markdown}
                  onDone={() => void onResubmitted()}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => { setNotice(null); setEditing(item.id); }}
                >
                  Edit and resend
                </button>
              )
            ) : null}
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
