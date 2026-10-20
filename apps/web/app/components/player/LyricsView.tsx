'use client';

import type { LyricsPayload } from '@drillke/shared';
import { findActiveLineIndex } from '@drillke/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from './PlayerProvider';

/**
 * Synchronized lyrics view.
 *
 * Contract (docs/architecture.md §5): the parent fetches one payload per song;
 * this component derives the active line from the player clock and re-renders
 * only when the active index changes.
 *
 * Phase 0 renders the unsynced, readable state. Phase 1 wires the loop:
 *
 *   useEffect(() => {
 *     let raf = 0;
 *     const tick = () => {
 *       const idx = findActiveLineIndex(lines, player.currentMs());
 *       setActive((prev) => (prev === idx ? prev : idx));
 *       raf = requestAnimationFrame(tick);
 *     };
 *     raf = requestAnimationFrame(tick);
 *     return () => cancelAnimationFrame(raf);
 *   }, [lines]);
 */
export default function LyricsView({ lyrics }: { lyrics: LyricsPayload | null }) {
  const { seekTo, registerSeek } = usePlayer();
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const lines = useMemo(() => lyrics?.lines ?? [], [lyrics]);
  const synchronized = lyrics?.syncStatus === 'synchronized';

  // Phase 1: the player surface registers its seek function here.
  useEffect(() => () => registerSeek(null), [registerSeek]);

  // Scroll only when the active line leaves the viewport.
  useEffect(() => {
    if (!synchronized || activeIndex < 0) return;
    const el = lineRefs.current.get(activeIndex);
    const container = containerRef.current;
    if (!el || !container) return;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    if (elTop < container.scrollTop || elBottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: elTop - container.clientHeight / 3, behavior: 'smooth' });
    }
  }, [activeIndex, synchronized]);

  if (!lyrics || lines.length === 0) {
    return (
      <div className="lyrics">
        <p className="lyrics__empty">Lyrics coming soon. Know this one?</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Lyrics</h2>
        <span className="badge">{synchronized ? 'Synchronized' : 'Not yet synchronized'}</span>
      </div>
      <div className="lyrics" ref={containerRef} aria-label="Lyrics">
        {lines.map((line) => (
          <button
            key={line.index}
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
