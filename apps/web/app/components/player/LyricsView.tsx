'use client';

import type { Annotation, LyricLine, LyricsPayload } from '@drillke/shared';
import { findActiveLineIndex } from '@drillke/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from './PlayerProvider';

/**
 * Annotations that belong to one lyric line, with their index in the published
 * list so the open/closed state survives re-renders.
 *
 * `resolveAnnotations` always stores a 0-based `lineIndex`, so matching on it is
 * exact and unambiguous — even when the same phrase appears on two lines. A
 * stored annotation without a line (legacy rows) falls back to the first line
 * containing the phrase, which is the same rule the resolver applies when an
 * author omits the anchor. That fallback returns the *first* match rather than
 * the first line on screen: `find` over `lines` is what "first matching line"
 * means in `docs/lyrics-format.md` §2.
 */
export function lineAnnotations(
  annotations: readonly Annotation[],
  line: LyricLine,
): { annotation: Annotation; index: number }[] {
  const matches: { annotation: Annotation; index: number }[] = [];
  annotations.forEach((annotation, index) => {
    if (annotation.lineIndex === line.index) {
      matches.push({ annotation, index });
    } else if (annotation.lineIndex == null) {
      const needle = annotation.phrase.toLocaleLowerCase();
      if (line.text.toLocaleLowerCase().includes(needle)) matches.push({ annotation, index });
    }
  });
  return matches;
}

/**
 * Synchronized lyrics view.
 *
 * Contract (docs/architecture.md §5): the parent fetches one payload per song;
 * this component derives the active line from the player clock and re-renders
 * only when the active index changes.
 *
 * The YouTube-backed player clock drives highlighting and click-to-seek;
 * untimed lines remain readable without implying synchronization.
 */
export default function LyricsView({ lyrics }: { lyrics: LyricsPayload | null }) {
  const { seekTo, currentMs } = usePlayer();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openAnnotation, setOpenAnnotation] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const lines = useMemo(() => lyrics?.lines ?? [], [lyrics]);
  const synchronized = lyrics?.syncStatus === 'synchronized';

  useEffect(() => {
    if (!synchronized) {
      setActiveIndex(-1);
      return;
    }
    const next = findActiveLineIndex(lines, currentMs);
    setActiveIndex((previous) => previous === next ? previous : next);
  }, [currentMs, lines, synchronized]);

  // Scroll only when the active line leaves the viewport.
  useEffect(() => {
    if (!synchronized || !autoScroll || activeIndex < 0) return;
    const el = lineRefs.current.get(activeIndex);
    const container = containerRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    if (elTop < container.scrollTop || elBottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: elTop - container.clientHeight / 3, behavior: 'smooth' });
    }
  }, [activeIndex, autoScroll, synchronized]);

  if (!lyrics || lines.length === 0) {
    return (
      <div className="lyrics">
        <p className="lyrics__empty">Lyrics coming soon. Know this one?</p>
      </div>
    );
  }

  return (
    <div>
      <div className="lyrics__heading">
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Lyrics</h2>
        <div className="lyrics__heading-actions">
          <span className="badge">{synchronized ? 'Synchronized' : 'Not yet synchronized'}</span>
          {synchronized ? <button type="button" className="btn btn--sm" onClick={() => setAutoScroll((value) => !value)} aria-pressed={autoScroll}>Auto-scroll {autoScroll ? 'on' : 'off'}</button> : null}
        </div>
      </div>
      {synchronized ? (
        <div className="lyrics__navigation" aria-label="Lyric navigation">
          <button type="button" className="btn btn--sm" disabled={activeIndex <= 0} onClick={() => seekTo(lines[Math.max(0, activeIndex - 1)].startMs)}>Previous line</button>
          <span className="muted" aria-live="polite">{activeIndex >= 0 ? `${activeIndex + 1} / ${lines.length}` : 'Waiting for lyrics'}</span>
          <button type="button" className="btn btn--sm" disabled={activeIndex >= lines.length - 1} onClick={() => seekTo(lines[Math.max(0, activeIndex + 1)].startMs)}>Next line</button>
        </div>
      ) : null}
      <div className="lyrics" ref={containerRef} aria-label="Lyrics">
        {lines.map((line) => (
          <div key={line.index}>
            <button
              ref={(el) => {
                if (el) lineRefs.current.set(line.index, el);
                else lineRefs.current.delete(line.index);
              }}
              type="button"
              className="lyrics__line"
              aria-current={line.index === activeIndex ? 'true' : undefined}
              onClick={() => synchronized && seekTo(line.startMs)}
            >
              {line.text}
            </button>
            {lineAnnotations(lyrics.annotations, line).map(({ annotation, index: annotationIndex }) => (
              <span className="lyrics__annotation" key={`${annotation.phrase}-${annotationIndex}`}>
                <button type="button" className="lyrics__annotation-trigger" aria-expanded={openAnnotation === annotationIndex} onClick={() => setOpenAnnotation((current) => current === annotationIndex ? null : annotationIndex)}>
                  {annotation.phrase} · meaning
                </button>
                {openAnnotation === annotationIndex ? <span className="lyrics__annotation-explanation" role="note">{annotation.explanation}</span> : null}
              </span>
            ))}
          </div>
        ))}
      </div>
      {synchronized ? (
        <p className="muted" style={{ fontSize: '0.75rem' }}>
          Tap a line to jump to it.
        </p>
      ) : null}
    </div>
  );
}

export { findActiveLineIndex };
