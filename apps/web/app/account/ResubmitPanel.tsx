'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { apiRequest } from '../../api';
import LyricsEditor from '../components/LyricsEditor';

interface ResubmitPanelProps {
  submissionId: string;
  songTitle: string;
  /** The reviewer's note — the reason this panel exists. */
  reviewNote: string | null;
  /** The text currently under review, so the contributor edits rather than retypes. */
  initialMarkdown: string;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Edit a submission the reviewer asked for changes on, and send it back.
 *
 * The contributor should never have to retype a document to act on a note, so
 * the editor opens prefilled with the text under review and the note sits above
 * it while they work.
 *
 * The API decides eligibility (`PUT /api/lyrics/submissions/:id`); this panel
 * only renders where the shared `isResubmittable` rule says it may.
 */
export default function ResubmitPanel({
  submissionId,
  songTitle,
  reviewNote,
  initialMarkdown,
  onDone,
  onCancel,
}: ResubmitPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(initialMarkdown.trim().length > 0);
  const onValidityChange = useCallback((next: boolean) => setValid(next), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const markdown = String(form.get('markdown') ?? '');
    const note = String(form.get('note') ?? '').trim();
    if (!markdown.trim()) {
      setError('The lyrics cannot be empty.');
      return;
    }
    setBusy(true);
    const result = await apiRequest<{ id: string; status: string }>(
      'PUT',
      `/api/lyrics/submissions/${encodeURIComponent(submissionId)}`,
      { markdown, ...(note ? { note } : {}) },
    );
    setBusy(false);
    if (!result.ok) {
      setError(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
      <p style={{ margin: 0, fontWeight: 600 }}>Fix and resend — {songTitle}</p>
      {reviewNote ? (
        <p className="muted" style={{ margin: 0 }} role="note">
          Reviewer asked for: {reviewNote}
        </p>
      ) : null}

      <LyricsEditor
        initialMarkdown={initialMarkdown}
        idPrefix={`resubmit-${submissionId}`}
        onValidityChange={onValidityChange}
      />

      <label htmlFor={`resubmit-note-${submissionId}`} style={{ fontWeight: 600 }}>
        Note for the reviewer (optional)
      </label>
      <input
        id={`resubmit-note-${submissionId}`}
        name="note"
        maxLength={500}
        placeholder="What you changed"
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !valid}>
          {busy ? 'Sending…' : 'Resend for review'}
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
    </form>
  );
}