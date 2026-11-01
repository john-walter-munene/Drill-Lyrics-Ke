'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseLyricsDocument, type LyricsDocument } from '@drillke/shared';
import type { Song } from '@drillke/shared';
import { browserGet, postJson } from '../../api';

interface CreatedSubmission {
  id: string;
  status: string;
}

type EditorMode = 'lines' | 'markdown';

export default function LyricsSubmissionForm({ songs }: { songs: Song[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalogue, setCatalogue] = useState(songs);
  const [selectedSongId, setSelectedSongId] = useState(songs.find((song) => song.slug === 'player-test-npvw1ntged4')?.id ?? songs[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<EditorMode>('lines');
  const [markdown, setMarkdown] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  useEffect(() => { if (catalogue.length && !catalogue.some((song) => song.id === selectedSongId)) setSelectedSongId(catalogue[0].id); }, [catalogue, selectedSongId]);
  useEffect(() => { void browserGet<{ user: unknown }>('/api/auth/me').then((result) => setSignedIn(Boolean(result?.user))); }, []);
  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: '1' }); if (query.trim()) params.set('q', query.trim());
      try { const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/songs?${params}`, { cache: 'no-store' }); if (response.ok) { const result = await response.json() as { items: Song[] }; setCatalogue(result.items); } } catch { /* Keep initial catalogue available offline. */ }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Live validation of the pasted/uploaded document, so a contributor sees the
   * problem before submitting rather than after a moderator rejects it. The API
   * re-validates with the same function (`parseLyricsDocument`), so this cannot
   * accept something the server will refuse.
   */
  const documentCheck = useMemo(() => {
    if (mode !== 'markdown' || !markdown.trim()) return null;
    return parseLyricsDocument(markdown);
  }, [mode, markdown]);

  const documentIssues = documentCheck && !documentCheck.ok
    ? Object.entries(documentCheck.errors).flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
    : [];

  /** The selected song's slug, so an uploaded document can be matched to it. */
  const selectedSong = catalogue.find((song) => song.id === selectedSongId) ?? null;

  const documentSongMismatch = documentCheck?.ok && selectedSong
    ? documentMismatch(documentCheck.document, selectedSong)
    : null;

  async function loadFile(file: File) {
    setError(null);
    setMessage(null);
    if (file.size > 512 * 1024) {
      setError('That file is larger than 512 KB. Trim it before uploading.');
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setError('Choose a Markdown file (.md) or a plain text file.');
      return;
    }
    try {
      const text = await file.text();
      setMarkdown(text);
      setFileName(file.name);
      setMode('markdown');
    } catch {
      setError('That file could not be read.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const songId = selectedSongId;
    const markdownBody = mode === 'markdown' ? markdown : String(form.get('lyrics') ?? '');
    const note = String(form.get('note') ?? '').trim();
    const creditPublicly = form.get('creditPublicly') === 'on';
    if (mode === 'markdown' && (!documentCheck || !documentCheck.ok)) {
      setError('Fix the document before submitting.');
      return;
    }
    setBusy(true);
    const result = await postJson<CreatedSubmission>('/api/lyrics/submissions', {
      songId,
      markdown: markdownBody,
      ...(note ? { note } : {}),
      ...(creditPublicly ? { creditPublicly: true } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      return;
    }
    setMessage(`Submitted for review. Reference: ${result.data.id}`);
    setMarkdown('');
    setFileName(null);
    formElement.reset();
  }

  return (
    <form onSubmit={submit} style={{ marginTop: '1.5rem', display: 'grid', gap: '0.75rem' }}>
      <label htmlFor="songId" style={{ fontWeight: 600 }}>Catalogue song</label>
      <label htmlFor="songSearch">Search by title or artist</label>
      <input id="songSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing a song or artist name" />
      {catalogue.length ? (
        <select id="songId" name="songId" required value={catalogue.some((song) => song.id === selectedSongId) ? selectedSongId : catalogue[0].id} onChange={(event) => setSelectedSongId(event.target.value)}>
          {catalogue.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}{song.artistNames.length ? ` — ${song.artistNames.join(', ')}` : ''}
            </option>
          ))}
        </select>
      ) : (
        <p className="muted">No published songs are available yet. Add a song to the catalogue first.</p>
      )}

      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600, padding: '0 0.35rem' }}>How are you submitting?</legend>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="radio" name="mode" value="lines" checked={mode === 'lines'} onChange={() => setMode('lines')} />
            One line per row
          </label>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="radio" name="mode" value="markdown" checked={mode === 'markdown'} onChange={() => setMode('markdown')} />
            Markdown file with frontmatter
          </label>
        </div>
      </fieldset>

      {mode === 'markdown' ? (
        <>
          <label htmlFor="lyricsFile" style={{ fontWeight: 600 }}>Upload a Markdown file</label>
          <input
            id="lyricsFile"
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          {fileName ? <p className="muted" style={{ margin: 0 }}>Loaded {fileName}. Edit it below if needed.</p> : null}

          <label htmlFor="markdown" style={{ fontWeight: 600 }}>Or paste the document</label>
          <textarea
            id="markdown"
            name="markdown"
            rows={16}
            value={markdown}
            onChange={(event) => { setMarkdown(event.target.value); setFileName(null); }}
            placeholder={'---\ntitle: "Song title"\nartist: "Artist"\nyoutubeVideoId: "dQw4w9WgXcQ"\n---\n\n[00:12.500] First line…'}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)',
              borderRadius: 8, padding: '0.7rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85rem', resize: 'vertical',
            }}
          />

          {documentCheck?.ok ? (
            <p className="muted" role="status">
              Ready: {documentCheck.document.lyrics.lines.length} lines,{' '}
              {documentCheck.document.lyrics.syncStatus === 'synchronized' ? 'synchronized' : 'not synchronized'},{' '}
              {documentCheck.document.lyrics.annotations.length} annotation{documentCheck.document.lyrics.annotations.length === 1 ? '' : 's'}.
            </p>
          ) : null}
          {documentIssues.length ? (
            <div role="alert" className="player-shell__error">
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {documentIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          ) : null}
          {documentSongMismatch ? <p className="muted" role="status">{documentSongMismatch}</p> : null}
        </>
      ) : (
        <>
          <label htmlFor="lyrics" style={{ fontWeight: 600 }}>Lyrics</label>
          <textarea
            id="lyrics"
            name="lyrics"
            rows={14}
            required
            maxLength={512 * 1024}
            placeholder={'Paste one lyric line per row. Timestamps are optional.\n\n[00:12.500] First line…\n[00:15.200] Second line…'}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)',
              borderRadius: 8, padding: '0.7rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85rem', resize: 'vertical',
            }}
          />
        </>
      )}

      <label htmlFor="note" style={{ fontWeight: 600 }}>Note for the reviewer (optional)</label>
      <input id="note" name="note" maxLength={500} placeholder="Corrections, language, or timing notes" />

      {signedIn ? <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}><input type="checkbox" name="creditPublicly" /> Credit this submission to my profile if published</label> : <p className="muted">You can submit anonymously. <a href="/sign-in">Sign in</a> to save submission history and opt into contributor credit.</p>}

      <button type="submit" className="btn btn--primary" disabled={busy || catalogue.length === 0 || (mode === 'markdown' && !documentCheck?.ok)}>
        {busy ? 'Submitting…' : 'Submit for review'}
      </button>
      {message ? <p role="status" className="muted">{message}</p> : null}
      {error ? <p role="alert" className="player-shell__error">{error}</p> : null}
    </form>
  );
}

/**
 * Compare a parsed document against the catalogue song the contributor selected.
 *
 * The selected `songId` is authoritative (`docs/lyrics-format.md` §1): an
 * uploaded document cannot create a song, so a mismatch is a warning rather than
 * an error — the contributor may simply have picked the wrong row, and the
 * reviewer should see that before publishing lyrics to the wrong track.
 */
function documentMismatch(document: LyricsDocument, song: Song): string | null {
  const titleMatches = normalize(document.frontmatter.title) === normalize(song.title);
  const videoMatches = document.frontmatter.youtubeVideoId === song.youtubeVideoId;
  if (titleMatches && videoMatches) return null;
  if (!videoMatches) {
    return `This document is for YouTube video ${document.frontmatter.youtubeVideoId}, but the selected song uses ${song.youtubeVideoId}. Submitting will attach it to the selected song — check you picked the right one.`;
  }
  return `The document title is “${document.frontmatter.title}” but the selected song is “${song.title}”. Check you picked the right one.`;
}

/** Case- and punctuation-insensitive comparison, so "Song (Official Video)" ≈ "song". */
function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
