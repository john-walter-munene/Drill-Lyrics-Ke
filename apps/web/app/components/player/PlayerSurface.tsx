'use client';

import { useEffect, useState } from 'react';
import type { PlayerTrack } from './PlayerProvider';

/**
 * YouTube player surface.
 *
 * Phase 0 renders a facade so the iframe is never loaded until the user asks
 * for it (Core Web Vitals, and a clean empty state). Phase 1 replaces the
 * facade body with the IFrame Player API instance and registers `seekTo` on the
 * player context.
 */
export default function PlayerSurface({ track }: { track: PlayerTrack | null }) {
  const [playing, setPlaying] = useState(false);

  // A new track always starts behind the facade.
  useEffect(() => setPlaying(false), [track?.slug]);

  if (!track) {
    return (
      <div className="panel" style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center' }}>
        <p className="muted">Hit play on a song to start. Lyrics follow the music.</p>
      </div>
    );
  }

  if (playing) {
    return (
      <div style={{ aspectRatio: '16 / 9' }}>
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0, borderRadius: 'var(--radius)' }}
          src={`https://www.youtube-nocookie.com/embed/${track.youtubeVideoId}?autoplay=1`}
          title={`${track.title} — ${track.artistNames.join(', ')}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="panel"
      onClick={() => setPlaying(true)}
      style={{
        aspectRatio: '16 / 9',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        cursor: 'pointer',
        border: '1px solid var(--border)',
        color: 'var(--fg)',
      }}
      aria-label={`Play ${track.title}`}
    >
      <span>
        <span className="btn btn--primary">▶ Play</span>
        <span className="muted" style={{ display: 'block', marginTop: '0.75rem' }}>
          {track.title} · {track.artistNames.join(', ')}
        </span>
      </span>
    </button>
  );
}
