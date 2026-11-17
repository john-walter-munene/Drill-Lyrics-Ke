'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseLyricsDocument } from '@drillke/shared';

export type EditorMode = 'lines' | 'markdown';

export interface LyricsEditorValue {
  mode: EditorMode;
  /** The body to send: the pasted document, or the one-line-per-row text. */
  markdown: string;
}

interface LyricsEditorProps {
  /** Initial body, so a resubmission opens on the text under review. */
  initialMarkdown?: string;
  initialMode?: EditorMode;
  /** Disables the "not valid yet" state in the parent's submit button. */
  onValidityChange?: (valid: boolean) => void;
  idPrefix?: string;
}

/**
 * The lyric body editor: one-line-per-row, or a Markdown document.
 *
 * Extracted from the `/submit` form so a contributor correcting lyrics under
 * review gets the *same* editor as a contributor submitting them the first
 * time. Two implementations would drift, and the review loop is exactly where
 * the two must agree.
 *
 * Validation shown here mirrors `parseLyricsDocument`, which the API runs again
 * on submit — this is feedback, never authority.
 */
export default function LyricsEditor({
  initialMarkdown = '',
  initialMode = 'lines',
  onValidityChange,
  idPrefix = 'editor',
}: LyricsEditorProps) {
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const documentCheck = useMemo(() => {
    if (mode !== 'markdown' || !markdown.trim()) return null;
    return parseLyricsDocument(markdown);
  }, [mode, markdown]);

  const documentIssues = documentCheck && !documentCheck.ok
    ? Object.entries(documentCheck.errors).flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
    : [];

  // A text body is validated by the API; the editor only blocks a Markdown
  // document it can already see is unreadable.
  const isValid = mode === 'markdown'
    ? Boolean(documentCheck?.ok) && markdown.trim().length > 0
    : markdown.trim().length > 0;

  // Reported from an effect, not during render: notifying a parent is a side
  // effect, and doing it inside useMemo would mutate state mid-render.
  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  async function loadFile(file: File) {
    setFileError(null);
    if (file.size > 512 * 1024) {
      setFileError('That file is larger than 512 KB. Trim it before uploading.');
      return;
    }
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setFileError('Choose a Markdown file (.md) or a plain text file.');
      return;
    }
    try {
      setMarkdown(await file.text());
      setFileName(file.name);
      setMode('markdown');
    } catch {
      setFileError('That file could not be read.');
    }
  }

  return (
    <>
      <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem' }}>
        <legend style={{ fontWeight: 600, padding: '0 0.35rem' }}>How are you submitting?</legend>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="radio" name={`${idPrefix}-mode`} value="lines" checked={mode === 'lines'} onChange={() => setMode('lines')} />
            One line per row
          </label>
          <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <input type="radio" name={`${idPrefix}-mode`} value="markdown" checked={mode === 'markdown'} onChange={() => setMode('markdown')} />
            Markdown file with frontmatter
          </label>
        </div>
      </fieldset>

      {mode === 'markdown' ? (
        <>
          <label htmlFor={`${idPrefix}-file`} style={{ fontWeight: 600 }}>Upload a Markdown file</label>
          <input
            id={`${idPrefix}-file`}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          {fileName ? <p className="muted" style={{ margin: 0 }}>Loaded {fileName}. Edit it below if needed.</p> : null}
          {fileError ? <p role="alert" className="player-shell__error">{fileError}</p> : null}

          <label htmlFor={`${idPrefix}-markdown`} style={{ fontWeight: 600 }}>Or paste the document</label>
          <textarea
            id={`${idPrefix}-markdown`}
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
        </>
      ) : (
        <>
          <label htmlFor={`${idPrefix}-lines`} style={{ fontWeight: 600 }}>Lyrics</label>
          <textarea
            id={`${idPrefix}-lines`}
            rows={14}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
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

      {/* The parent reads the body from these hidden inputs, so it never has to
          mirror the editor's internal state. */}
      <input type="hidden" name="markdown" value={markdown} />
      <input type="hidden" name="mode" value={mode} />
    </>
  );
}