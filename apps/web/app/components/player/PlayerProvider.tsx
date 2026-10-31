'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
  youtubeVideoId: string | null;
}

export type PlaybackState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
export type PlaybackMode = 'listen' | 'watch';
export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerContextValue {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  currentMs: number;
  durationMs: number;
  playbackState: PlaybackState;
  playbackMode: PlaybackMode;
  setPlaybackMode: (mode: PlaybackMode) => void;
  shuffle: boolean;
  repeatMode: RepeatMode;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;
  play: (track: PlayerTrack, queue?: PlayerTrack[], autoplay?: boolean) => void;
  playPause: () => void;
  seekTo: (ms: number) => void;
  next: () => void;
  previous: () => void;
  ended: () => void;
  registerControls: (controls: PlayerControls | null) => void;
  reportTime: (currentMs: number, durationMs: number) => void;
  reportState: (state: PlaybackState) => void;
}

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  seekTo: (ms: number) => void;
  load: (videoId: string, autoplay: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [time, setTime] = useState({ currentMs: 0, durationMs: 0 });
  const [playbackState, setPlaybackState] = useState<PlaybackState>('unstarted');
  const [controls, setControls] = useState<PlayerControls | null>(null);
  const [modesBySong, setModesBySong] = useState<Record<string, PlaybackMode>>({});
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);
  const [playHistory, setPlayHistory] = useState<string[]>([]);

  const playbackMode = track ? modesBySong[track.slug] ?? 'watch' : 'watch';
  useEffect(() => {
    if (!track) return;
    try {
      const stored = window.localStorage.getItem(`drill-lyrics-mode:${track.slug}`);
      if (stored === 'listen' || stored === 'watch') {
        setModesBySong((previous) => previous[track.slug] === stored
          ? previous
          : { ...previous, [track.slug]: stored });
      }
    } catch {
      // Keep Watch as the default when browser storage is unavailable.
    }
  }, [track?.slug]);

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    if (!track) return;
    setModesBySong((previous) => ({ ...previous, [track.slug]: mode }));
    try {
      window.localStorage.setItem(`drill-lyrics-mode:${track.slug}`, mode);
    } catch {
      // Mode switching remains available when browser storage is unavailable.
    }
  }, [track]);

  const play = useCallback((next: PlayerTrack, nextQueue?: PlayerTrack[], autoplay = false) => {
    const selectedQueue = nextQueue?.length
      ? nextQueue
      : queue.some((item) => item.slug === next.slug) ? queue : [next];
    setQueue(selectedQueue);
    setPlayHistory([]);
    setTrack(next);
    setTime({ currentMs: 0, durationMs: 0 });
    setPlaybackState(next.youtubeVideoId ? (autoplay ? 'buffering' : 'unstarted') : 'error');
    if (next.youtubeVideoId) controls?.load(next.youtubeVideoId, autoplay);
    else controls?.pause();
  }, [controls, queue]);
  const seekTo = useCallback((ms: number) => controls?.seekTo(ms), [controls]);
  const playPause = useCallback(() => {
    if (!track?.youtubeVideoId) return;
    if (playbackState === 'playing' || playbackState === 'buffering') controls?.pause();
    else controls?.play();
  }, [controls, playbackState, track]);
  const loadTrack = useCallback((nextTrack: PlayerTrack, addHistory = true) => {
    if (!track) return;
    if (addHistory) setPlayHistory((items) => [...items, track.slug]);
    setTrack(nextTrack);
    setTime({ currentMs: 0, durationMs: 0 });
    setPlaybackState(nextTrack.youtubeVideoId ? 'buffering' : 'error');
    if (nextTrack.youtubeVideoId) controls?.load(nextTrack.youtubeVideoId, true);
    else controls?.pause();
  }, [controls, track]);
  const changeTrack = useCallback((delta: number, naturalEnd = false) => {
    if (!track || queue.length < 2) return;
    const index = queue.findIndex((item) => item.slug === track.slug);
    if (delta > 0 && shuffle) {
      const candidates = queue.filter((item) => item.slug !== track.slug);
      const randomTrack = candidates[Math.floor(Math.random() * candidates.length)];
      if (randomTrack) loadTrack(randomTrack);
      return;
    }
    const targetIndex = index + delta;
    const wrappedIndex = repeatMode === 'all' ? (targetIndex + queue.length) % queue.length : targetIndex;
    const nextTrack = queue[wrappedIndex];
    if (nextTrack) loadTrack(nextTrack);
    else if (naturalEnd) setPlaybackState('ended');
  }, [loadTrack, queue, repeatMode, shuffle, track]);
  const previous = useCallback(() => {
    if (!track || !queue.length) return;
    const previousSlug = playHistory[playHistory.length - 1];
    const previousTrack = previousSlug ? queue.find((item) => item.slug === previousSlug) : undefined;
    if (previousTrack) {
      setPlayHistory((items) => items.slice(0, -1));
      loadTrack(previousTrack, false);
      return;
    }
    const index = queue.findIndex((item) => item.slug === track.slug);
    if (index > 0) changeTrack(-1);
    else {
      controls?.seekTo(0);
      controls?.play();
    }
  }, [changeTrack, controls, loadTrack, playHistory, queue, track]);
  const ended = useCallback(() => {
    if (repeatMode === 'one' && track?.youtubeVideoId) {
      controls?.seekTo(0);
      controls?.play();
      return;
    }
    if (repeatMode === 'all' && queue.length === 1 && track?.youtubeVideoId) {
      controls?.seekTo(0);
      controls?.play();
      return;
    }
    changeTrack(1, true);
  }, [changeTrack, controls, queue.length, repeatMode, track]);
  const toggleShuffle = useCallback(() => setShuffle((value) => !value), []);
  const cycleRepeatMode = useCallback(() => setRepeatMode((mode) => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'), []);
  const registerControls = useCallback((next: PlayerControls | null) => setControls(next), []);
  const reportTime = useCallback((currentMs: number, durationMs: number) => {
    setTime((old) => old.currentMs === currentMs && old.durationMs === durationMs ? old : { currentMs, durationMs });
  }, []);
  const reportState = useCallback((state: PlaybackState) => setPlaybackState(state), []);

  const value = useMemo(
    () => ({
      track, queue, ...time, playbackState, playbackMode, setPlaybackMode, shuffle, repeatMode,
      toggleShuffle, cycleRepeatMode, queueOpen, setQueueOpen, play, seekTo, playPause,
      next: () => changeTrack(1), previous, ended,
      registerControls, reportTime, reportState,
    }),
    [track, queue, time, playbackState, playbackMode, setPlaybackMode, shuffle, repeatMode,
      toggleShuffle, cycleRepeatMode, queueOpen, play, seekTo, playPause, changeTrack, previous,
      ended, registerControls, reportTime, reportState],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}
