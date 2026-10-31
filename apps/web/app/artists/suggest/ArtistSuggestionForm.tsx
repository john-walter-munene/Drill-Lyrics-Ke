'use client';

import { useState, type FormEvent } from 'react';
import { postJson } from '../../../api';

/**
 * Guest artist-channel suggestion (`docs/api.md`: `POST /api/artists/suggestions`).
 *
 * The server resolves the channel through the YouTube Data API and queues it for
 * a moderator; nothing here creates an artist. The success message reports what
 * the server actually found, so a contributor can tell a wrong channel from a
 * right one before a reviewer looks at it.
 */
export default function ArtistSuggestionForm() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const channel = String(form.get('channel') ?? '');
    const name = String(form.get('name') ?? '').trim();

    setBusy(true);
    setStatus('');
    setError('');

    const result = await postJson<{ channelTitle?: string; sampleVideoCount?: number }>(
      '/api/artists/suggestions',
      { youtubeChannel: channel, ...(name ? { suggestedName: name } : {}) },
    );
    setBusy(false);

    if (!result.ok) {
      setError(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      return;
    }
    const title = result.data.channelTitle ?? 'The channel';
    const samples = result.data.sampleVideoCount ?? 'its';
    setStatus(`Thanks. ${title} is queued for review with ${samples} sample uploads.`);
    formElement.reset();
  }

  return (
    <form className="panel" onSubmit={submit} style={{ display: 'grid', gap: '.75rem', marginTop: '1.5rem' }}>
      <label>YouTube channel URL, channel ID, or @handle
        <input name="channel" required minLength={3} maxLength={300} placeholder="youtube.com/@artist" />
      </label>
      <label>Artist name (optional)
        <input name="name" maxLength={100} placeholder="Use the channel name if blank" />
      </label>
      <button className="btn btn--primary" disabled={busy}>
        {busy ? 'Verifying…' : 'Submit channel for review'}
      </button>
      {status ? <p role="status">{status}</p> : null}
      {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
    </form>
  );
}
