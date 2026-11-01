'use client';

import { useState } from 'react';
import {
  alignLyrics,
  MAX_ANNOTATION_EXPLANATION,
  MAX_ANNOTATION_PHRASE,
  msToTimestamp,
  parseLyricsText,
  resolveAnnotations,
  type Annotation,
} from '@drillke/shared';
import { API_URL } from '../../api';
import { usePlayer } from '../components/player/PlayerProvider';
import {
  chooseSyncRoute,
  decodeToMono,
  estimateOnServer,
  fitsServerLimit,
  measureAudio,
  readDeviceHints,
} from './sync-estimate';
import type { LyricsReviewItem } from './types';

/**
 * One submission in the review queue: timing editor, annotation editor, and the
 * review actions.
 *
 * Everything a moderator needs for a single submission lives here so the
 * dashboard itself only has to choose which card to render. The component owns
 * its draft state (`lines`, `annotations`) and reports it upward through
 * `onSave` / `onApprove`; it never talks to the API directly, which keeps the
 * "one place that writes" rule in `AdminDashboard`.
 */

interface TimingLine {
  text: string;
  startMs: number | null;
}

export interface LyricsReviewCardProps {
  item: LyricsReviewItem;
  busy: boolean;
  onSave: (markdown: string, annotations: Annotation[]) => void;
  onApprove: (annotations: Annotation[]) => void;
  onReject: () => void;
  onRequestChanges: () => void;
}

/** Flatten parser errors into one line a reviewer can act on. */
function formatErrors(errors: Record<string, string[]>): string {
  return Object.values(errors).flat().join(' ');
}

export default function LyricsReviewCard({
  item,
  busy,
  onSave,
  onApprove,
  onReject,
  onRequestChanges,
}: LyricsReviewCardProps) {
  const { track, currentMs, playbackState, play } = usePlayer();
  const parsedInitial = parseLyricsText(item.markdown);

  const [lines, setLines] = useState<TimingLine[]>(() => (parsedInitial.ok
    ? parsedInitial.lyrics.lines.map(({ text, startMs }) => ({ text, startMs: startMs >= 0 ? startMs : null }))
    : []));
  const [annotations, setAnnotations] = useState<Annotation[]>(() => item.publishedVersion?.annotations ?? []);
  const [selectedLine, setSelectedLine] = useState(0);
  const [phrase, setPhrase] = useState('');
  const [explanation, setExplanation] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState('');
  // Set when the moderator asked the server for an estimate explicitly.
  const [preferServer, setPreferServer] = useState(false);

  const timedCount = lines.filter((line) => line.startMs !== null).length;
  const allTimed = lines.length > 0 && timedCount === lines.length;
  const draft = serializeDraft(lines);
  const originalDraft = parsedInitial.ok
    ? serializeDraft(parsedInitial.lyrics.lines.map(({ text, startMs }) => ({ text, startMs: startMs >= 0 ? startMs : null })))
    : item.markdown;
  const validation = parseLyricsText(draft);
  const syncError = !parsedInitial.ok
    ? 'The submitted lyrics could not be parsed.'
    : !validation.ok ? formatErrors(validation.errors) : null;

  const annotationCheck = validation.ok ? resolveAnnotations(validation.lyrics.lines, annotations) : null;
  const annotationError = annotationCheck && !annotationCheck.ok ? formatErrors(annotationCheck.errors) : null;

  const publishedAnnotations = item.publishedVersion?.annotations ?? [];
  const annotationsChanged = JSON.stringify(annotations) !== JSON.stringify(publishedAnnotations);
  const canSave = validation.ok && !annotationError && (draft !== originalDraft || annotationsChanged);
  const isSongLoaded = track?.slug === item.song.slug;
  const artistNames = item.song.artists.map((entry) => entry.artist.name);

  function setLineTime(index: number, startMs: number | null) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, startMs } : line)));
  }

  function addAnnotation() {
    const line = lines[selectedLine];
    const value = phrase.trim();
    if (!line || !value || !explanation.trim()) return;
    setAnnotations((current) => [...current, { phrase: value, explanation: explanation.trim(), lineIndex: selectedLine }]);
    setPhrase('');
    setExplanation('');
  }

  function setAnnotationLine(index: number, lineIndex: number) {
    setAnnotations((current) => current.map((annotation, position) => (
      position === index ? { ...annotation, lineIndex } : annotation
    )));
  }

  function playForTiming() {
    const song = {
      slug: item.song.slug,
      title: item.song.title,
      artistNames,
      youtubeVideoId: item.song.youtubeVideoId,
    };
    play(song, [song], true);
  }

  /**
   * Pre-fill timings from the shared line-sync estimator.
   *
   * The estimate is a *starting point*, never a saved value
   * (`docs/lyrics-format.md` §7): it fills the inputs, the moderator reviews and
   * corrects them, and only the normal save path persists anything.
   *
   * Where it runs is `chooseSyncRoute`'s call: a capable device analyses the
   * clip locally, a weak one (few cores, little memory, data-saver, long clip)
   * or an explicit request offloads to
   * `POST /api/admin/lyrics/:id/sync-estimate`. Both sides run the same
   * `alignLyrics`, so the suggestion does not depend on the route.
   */
  async function estimateTimings(file: File) {
    setEstimating(true);
    setEstimateNote('');
    try {
      const texts = lines.map((line) => line.text);
      if (!texts.length) {
        setEstimateNote('Add lyric lines before estimating.');
        return;
      }

      const durationSeconds = await measureAudio(file);
      const decision = preferServer
        ? { route: 'server' as const, reason: 'You asked the server to analyse this clip.' }
        : chooseSyncRoute({ durationSeconds, sizeBytes: file.size }, readDeviceHints());

      let result;
      let routeNote = '';

      if (decision.route === 'server') {
        if (!fitsServerLimit(durationSeconds)) {
          setEstimateNote(`Clips longer than ${Math.round(durationSeconds / 60)} minutes cannot be sent to the server. Time these lines with the player instead.`);
          return;
        }
        result = await estimateOnServer(API_URL, item.id, file, texts);
        routeNote = `${decision.reason} It ran on the server. `;
      } else {
        const samples = await decodeToMono(file);
        result = alignLyrics({ samples, sampleRate: 16_000 }, texts);
      }

      if (!result.ok) {
        setEstimateNote(result.error.message);
        return;
      }

      const { startsMs, confidence, coverage } = result.estimate;
      setLines((current) => current.map((line, index) => ({
        ...line,
        startMs: startsMs[index] ?? line.startMs,
      })));
      setEstimateNote(
        `${routeNote}Estimated from the audio — confidence ${Math.round(confidence * 100)}%, `
        + `${Math.round(coverage * 100)}% of the clip used. Check every line against playback before saving.`,
      );
    } catch (error) {
      // The server path can fail on transport, role or decode; the local path on
      // a codec the browser cannot read. Both land here with a readable message.
      setEstimateNote(error instanceof Error ? error.message : 'The clip could not be analysed.');
    } finally {
      setEstimating(false);
    }
  }

  const annotationReady = Boolean(
    phrase.trim()
    && explanation.trim()
    && lines[selectedLine]
    && lines[selectedLine].text.toLocaleLowerCase().includes(phrase.trim().toLocaleLowerCase()),
  );

  return (
    <article className="panel lyrics-review-card">
      <header className="lyrics-review-card__heading">
        <div>
          <h2>{item.song.title}{artistNames.length ? ` — ${artistNames.join(', ')}` : ''}</h2>
          <p className="muted">
            {item.user?.displayName ?? 'Anonymous'} · {item.status} · {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
        <a href={`https://www.youtube.com/watch?v=${item.song.youtubeVideoId}`} target="_blank" rel="noreferrer">
          Open video on YouTube ↗
        </a>
      </header>

      <section className="lyrics-sync-editor" aria-label="Lyric timing editor">
        <div className="lyrics-sync-editor__toolbar">
          <div>
            <strong>Sync lyrics to playback</strong>
            <p className="muted">Play the video, then mark each line when its first syllable begins. Adjust its time in seconds if needed.</p>
          </div>
          <button type="button" className="btn btn--primary btn--sm" onClick={playForTiming}>
            {isSongLoaded && playbackState === 'playing' ? 'Restart timing playback' : 'Play video for timing'}
          </button>
        </div>

        <div className="lyrics-sync-editor__progress">
          <progress max={Math.max(lines.length, 1)} value={timedCount} aria-label={`${timedCount} of ${lines.length} lyric lines timed`} />
          <span>{timedCount} / {lines.length} lines timed</span>
          {isSongLoaded
            ? <span className="muted" aria-live="off">Player {msToTimestamp(currentMs)}</span>
            : <span className="muted">Start playback to mark lines</span>}
        </div>

        <div className="lyrics-sync-editor__toolbar">
          <div>
            <strong>Estimate timings from an audio file</strong>
            <p className="muted">
              Optional starting point: pick the song&apos;s audio and the estimator fills every line.
              It never saves on its own — review each line against playback first.
            </p>
          </div>
          <div className="lyrics-sync-editor__estimate-actions">
            <label className="btn btn--sm" style={{ cursor: estimating ? 'wait' : 'pointer' }}>
              {estimating ? 'Estimating…' : 'Choose audio file'}
              <input
                type="file"
                accept="audio/*"
                hidden
                disabled={estimating}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void estimateTimings(file);
                  event.target.value = '';
                }}
              />
            </label>
            <label className="lyrics-sync-editor__server-toggle muted">
              <input
                type="checkbox"
                checked={preferServer}
                disabled={estimating}
                onChange={(event) => setPreferServer(event.target.checked)}
              />
              Estimate on the server
            </label>
          </div>
        </div>
        {estimateNote ? <p className="lyrics-sync-editor__hint muted" role="status">{estimateNote}</p> : null}

        {syncError ? <p className="lyrics-sync-editor__error" role="alert">{syncError}</p> : null}
        <ol className="lyrics-sync-editor__lines">
          {lines.map((line, index) => (
            <li key={`${index}-${line.text}`}>
              <span className="lyrics-sync-editor__line-number">{index + 1}</span>
              <span className="lyrics-sync-editor__line-text">{line.text}</span>
              <label className="lyrics-sync-editor__time-label">
                <span className="visually-hidden">Line {index + 1} start time in seconds</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.startMs === null ? '' : (line.startMs / 1000).toFixed(3)}
                  onChange={(event) => setLineTime(
                    index,
                    event.target.value === '' ? null : Math.round(Math.max(0, Number(event.target.value)) * 1000),
                  )}
                />
                <span className="muted">sec</span>
              </label>
              <button
                type="button"
                className="btn btn--sm"
                disabled={!isSongLoaded}
                onClick={() => setLineTime(index, Math.max(0, Math.round(currentMs)))}
              >
                Use player time
              </button>
            </li>
          ))}
        </ol>

        <p className="muted lyrics-sync-editor__hint">
          Lines must stay in playback order. You can scrub with the YouTube player and fine-tune each value before saving.
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy || !validation.ok || draft === originalDraft}
          onClick={() => onSave(draft, annotations)}
        >
          {item.status === 'published' ? 'Save updated lyric version' : 'Save lyric timings'}
        </button>
      </section>

      <section className="lyrics-sync-editor" aria-label="Lyric annotations">
        <div className="lyrics-sync-editor__toolbar">
          <div>
            <strong>Explain the bars</strong>
            <p className="muted">
              Attach an explanation of a Sheng phrase, slang or reference to the line it appears on.
              The phrase must be part of that line. Explanations go live when this version is saved or approved.
            </p>
          </div>
          <span className="badge">{annotations.length} annotation{annotations.length === 1 ? '' : 's'}</span>
        </div>

        {annotations.length ? (
          <ol className="lyrics-sync-editor__lines lyrics-annotation-editor__list">
            {annotations.map((annotation, index) => (
              <li key={`${annotation.phrase}-${index}`}>
                <span className="lyrics-sync-editor__line-number">{index + 1}</span>
                <span className="lyrics-sync-editor__line-text">
                  <strong>{annotation.phrase}</strong> — {annotation.explanation}
                </span>
                <label className="lyrics-sync-editor__time-label">
                  <span className="visually-hidden">Line for annotation {index + 1}</span>
                  <select
                    value={annotation.lineIndex ?? 0}
                    onChange={(event) => setAnnotationLine(index, Number(event.target.value))}
                  >
                    {lines.map((line, lineIndex) => (
                      <option key={lineIndex} value={lineIndex}>{lineIndex + 1}: {line.text.slice(0, 40)}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setAnnotations((current) => current.filter((_, position) => position !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        ) : <p className="muted">No annotations yet.</p>}

        <div className="lyrics-annotation-editor__form">
          <label>Line
            <select value={selectedLine} onChange={(event) => setSelectedLine(Number(event.target.value))}>
              {lines.map((line, lineIndex) => (
                <option key={lineIndex} value={lineIndex}>{lineIndex + 1}: {line.text.slice(0, 60)}</option>
              ))}
            </select>
          </label>
          <label>Phrase
            <input
              value={phrase}
              maxLength={MAX_ANNOTATION_PHRASE}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder="Copy a phrase from that line"
            />
          </label>
          <label>Explanation
            <textarea
              value={explanation}
              maxLength={MAX_ANNOTATION_EXPLANATION}
              rows={2}
              onChange={(event) => setExplanation(event.target.value)}
              placeholder="What it means, where it comes from"
            />
          </label>
          <button type="button" className="btn" disabled={!annotationReady} onClick={addAnnotation}>
            Add annotation
          </button>
        </div>
        {annotationError ? <p className="lyrics-sync-editor__error" role="alert">{annotationError}</p> : null}
        {annotations.length && !annotationError ? (
          <p className="lyrics-sync-editor__hint muted">
            A phrase must appear on the line it is anchored to. Explanations go live when this version is saved or approved.
          </p>
        ) : null}
        <button type="button" className="btn" disabled={busy || !canSave} onClick={() => onSave(draft, annotations)}>
          Save annotations
        </button>
      </section>

      <div className="lyrics-review-card__actions">
        {item.status === 'published' ? (
          <p className="muted">
            Published lyrics are live. Saving edits creates a new version and keeps this one in the version history.
          </p>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || Boolean(annotationError)}
              onClick={() => onApprove(annotations)}
            >
              {allTimed ? 'Approve & publish synchronized lyrics' : 'Approve & publish unsynchronized lyrics'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={onReject}>Reject</button>
            <button type="button" className="btn" disabled={busy} onClick={onRequestChanges}>Request changes</button>
          </>
        )}
      </div>
      {item.note ? <p className="muted">Contributor note: {item.note}</p> : null}
    </article>
  );
}

/**
 * Render the working lines back to the text form the API stores.
 *
 * The untimed form is the same shape `parseLyricsText` reads, so the round trip
 * through the editor cannot introduce a timestamp format the parser rejects.
 */
function serializeDraft(lines: readonly { text: string; startMs: number | null }[]): string {
  return lines
    .map((line) => (line.startMs === null ? line.text : `[${msToTimestamp(line.startMs)}] ${line.text}`))
    .join('\n');
}
