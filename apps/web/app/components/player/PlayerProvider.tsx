'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Minimal playback state shared by the persistent player and the lyrics view.
 *
 * Phase 0 only carries the *current track* and a seek handle. Phase 1 adds the
 * YouTube IFrame instance, the timing loop and `currentMs`, without changing
 * this context's shape for consumers.
 */
export interface PlayerTrack {
  slug: string;
  title: string;
  artistNames: string[];
  youtubeVideoId: string;
}

interface PlayerContextValue {
  track: PlayerTrack | null;
  play: (track: PlayerTrack) => void;
  /** Registered by the player surface; lets a lyric click seek. */
  seekTo: (ms: number) => void;
  registerSeek: (fn: ((ms: number) => void) | null) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [seekFn, setSeekFn] = useState<{ fn: ((ms: number) => void) | null }>({ fn: null });

  const play = useCallback((next: PlayerTrack) => setTrack(next), []);
  const seekTo = useCallback(
    (ms: number) => {
      seekFn.fn?.(ms);
    },
    [seekFn],
  );
  const registerSeek = useCallback((fn: ((ms: number) => void) | null) => {
    setSeekFn({ fn });
  }, []);

  const value = useMemo(
    () => ({ track, play, seekTo, registerSeek }),
    [track, play, seekTo, registerSeek],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
