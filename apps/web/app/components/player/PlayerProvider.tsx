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

/** One key for the whole player: the Listen/Watch choice survives a new track. */
const MODE_KEY = 'drill-lyrics-mode';
/** The loaded track and queue, so a full page load keeps the session's player. */
const SESSION_KEY = 'drill-lyrics-session';

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [time, setTime] = useState({ currentMs: 0, durationMs: 0 });
  const [playbackState, setPlaybackState] = useState<PlaybackState>('unstarted');
  const [controls, setControls] = useState<PlayerControls | null>(null);
  const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>('watch');
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);
  const [playHistory, setPlayHistory] = useState<string[]>([]);

  // Restore the session's track and queue after a full page load, cued rather
  // than playing. Runs once, before any song page can register its own track.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { track?: PlayerTrack; queue?: PlayerTrack[] };
      if (!saved.track?.slug) return;
      setTrack((current) => current ?? saved.track!);
      setQueue((current) => (current.length ? current : saved.queue ?? [saved.track!]));
      setPlaybackState(saved.track.youtubeVideoId ? 'unstarted' : 'error');
    } catch {
      // A malformed or unreadable entry is simply ignored.
    }
  }, []);

  // Listen/Watch is a preference for the whole player, not a fact about one
  // song. It used to be stored per slug, so picking a new track silently fell
  // back to Watch — the choice vanished exactly when a listener moved on.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_KEY);
      if (stored === 'listen' || stored === 'watch') setPlaybackModeState(stored);
    } catch {
      // Keep Watch as the default when browser storage is unavailable.
    }
  }, []);

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    setPlaybackModeState(mode);
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Mode switching remains available when browser storage is unavailable.
    }
  }, []);

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

  // Remember what is loaded, so a full page load does not silently lose the
  // session's track and queue. A fresh track is NOT autoplayed on restore: a
  // browser blocks that, and a page load is not a "play" gesture. The player
  // restores the song cued at the front, one click from resuming.
  useEffect(() => {
    if (!track) return;
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        track: { slug: track.slug, title: track.title, artistNames: track.artistNames, youtubeVideoId: track.youtubeVideoId },
        queue,
      }));
    } catch {
      // Private mode: playback just will not survive a reload.
    }
  }, [track, queue]);
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
