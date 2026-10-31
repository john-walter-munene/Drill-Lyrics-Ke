'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlaybackState, PlayerTrack } from './PlayerProvider';
import { usePlayer } from './PlayerProvider';
import TransportControls, { QueueList } from './TransportControls';

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  cueVideoById(videoId: string): void;
  loadVideoById(videoId: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange: (event: { target: YouTubePlayer; data: number }) => void;
      onError: () => void;
      onAutoplayBlocked: () => void;
    };
  }) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube player API did not initialize'));
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-drillke-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.drillkeYoutubeApi = 'true';
      script.onerror = () => reject(new Error('Could not load YouTube player API'));
      document.head.appendChild(script);
    }
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise!;
}

function playbackStateFromYouTube(value: number): PlaybackState {
  switch (value) {
    case 1: return 'playing';
    case 2: return 'paused';
    case 3: return 'buffering';
    case 0: return 'ended';
    case -1:
    case 5: return 'unstarted';
    default: return 'error';
  }
}

/** A single visible YouTube IFrame player, mounted for the lifetime of the app. */
export default function PlayerSurface({ track }: { track: PlayerTrack | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const lastVideoIdRef = useRef<string | null>(null);
  const latestTrackRef = useRef(track);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    queue, playbackState, playbackMode, setPlaybackMode, registerControls, reportState, reportTime,
    currentMs, durationMs, playPause, next, previous, ended, shuffle, repeatMode, toggleShuffle,
    cycleRepeatMode, queueOpen, setQueueOpen, play,
  } = usePlayer();
  const playbackStateRef = useRef(playbackState);
  const endedRef = useRef(ended);
  const [volume, setVolume] = useState(75);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  latestTrackRef.current = track;
  playbackStateRef.current = playbackState;
  endedRef.current = ended;

  useEffect(() => {
    if (!track?.youtubeVideoId || !containerRef.current || playerRef.current) return;
    const initialVideoId = track.youtubeVideoId;
    let cancelled = false;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current || playerRef.current) return;
      lastVideoIdRef.current = initialVideoId;
      const player = new YT.Player(containerRef.current, {
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target;
            setReady(true);
            registerControls({
              play: () => target.playVideo(),
              pause: () => target.pauseVideo(),
              seekTo: (ms) => target.seekTo(Math.max(0, ms) / 1000, true),
              setVolume: (value) => target.setVolume(Math.max(0, Math.min(100, value))),
              mute: () => target.mute(),
              unmute: () => target.unMute(),
              load: (videoId, autoplay) => {
                lastVideoIdRef.current = videoId;
                setError(null);
                if (autoplay) target.loadVideoById(videoId);
                else target.cueVideoById(videoId);
              },
            });
            const latest = latestTrackRef.current;
            setVolume(target.getVolume());
            setMuted(target.isMuted());
            setPlaybackRate(target.getPlaybackRate());
            const autoplayRequested = playbackStateRef.current === 'buffering';
            if (latest?.youtubeVideoId && latest.youtubeVideoId !== lastVideoIdRef.current) {
              lastVideoIdRef.current = latest.youtubeVideoId;
              if (autoplayRequested) target.loadVideoById(latest.youtubeVideoId);
              else target.cueVideoById(latest.youtubeVideoId);
            } else if (latest?.youtubeVideoId && autoplayRequested) {
              target.loadVideoById(latest.youtubeVideoId);
            }
          },
          onStateChange: ({ target, data }) => {
            const state = playbackStateFromYouTube(data);
            reportState(state);
            if (state === 'ended') endedRef.current();
            const current = target.getCurrentTime();
            const duration = target.getDuration();
            reportTime(Number.isFinite(current) ? Math.round(current * 1000) : 0,
              Number.isFinite(duration) ? Math.round(duration * 1000) : 0);
          },
          onError: () => {
            setError('This YouTube video cannot be played here. Open it on YouTube instead.');
            reportState('error');
          },
          onAutoplayBlocked: () => reportState('paused'),
        },
      });
      playerRef.current = player;
    }).catch(() => setError('The YouTube player could not be loaded. Check your connection and try again.'));
    return () => { cancelled = true; };
  }, [track, registerControls, reportState, reportTime]);

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const current = player.getCurrentTime();
      const duration = player.getDuration();
      const currentVolume = player.getVolume();
      const currentRate = player.getPlaybackRate();
      const currentlyMuted = player.isMuted();
      if (Number.isFinite(currentVolume)) setVolume((old) => old === currentVolume ? old : currentVolume);
      if (Number.isFinite(currentRate)) setPlaybackRate((old) => old === currentRate ? old : currentRate);
      if (currentlyMuted !== muted) setMuted(currentlyMuted);
      reportTime(Number.isFinite(current) ? Math.round(current * 1000) : 0,
        Number.isFinite(duration) ? Math.round(duration * 1000) : 0);
    }, 200);
    return () => window.clearInterval(timer);
  }, [ready, reportTime, muted]);

  useEffect(() => () => {
    registerControls(null);
    playerRef.current?.destroy();
    playerRef.current = null;
  }, [registerControls]);

  const openOnYouTube = track?.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.youtubeVideoId)}`
    : null;
  const seekTo = (milliseconds: number) => playerRef.current?.seekTo(Math.max(0, milliseconds) / 1000, true);
  const changeVolume = (value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    setVolume(normalized);
    playerRef.current?.setVolume(normalized);
    if (normalized === 0) playerRef.current?.mute();
    else playerRef.current?.unMute();
  };
  const changeRate = (value: number) => {
    playerRef.current?.setPlaybackRate(value);
    setPlaybackRate(value);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space') { event.preventDefault(); playPause(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); seekTo(currentMs - 10000); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); seekTo(Math.min(durationMs, currentMs + 10000)); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); changeVolume(volume + 5); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); changeVolume(volume - 5); }
      else if (event.key.toLowerCase() === 'n') next();
      else if (event.key.toLowerCase() === 'p') previous();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentMs, durationMs, next, playPause, previous, volume]);

  return (
    <section className={`player-shell player-shell--${playbackMode}`} aria-label="Music player">
      {track ? (
        <>
          <div className="player-shell__mode-switch" role="group" aria-label="Playback view">
            <button type="button" className={playbackMode === 'listen' ? 'is-active' : ''} aria-pressed={playbackMode === 'listen'} onClick={() => setPlaybackMode('listen')}>Listen</button>
            <button type="button" className={playbackMode === 'watch' ? 'is-active' : ''} aria-pressed={playbackMode === 'watch'} onClick={() => setPlaybackMode('watch')}>Watch</button>
          </div>

          <div className="player-shell__layout">
            <div className="player-shell__video">
              <div ref={containerRef} className="player-shell__iframe" />
              {!track.youtubeVideoId ? (
                <div className="player-shell__fallback" role="status">
                  <span aria-hidden="true">♫</span>
                  <strong>No video linked yet</strong>
                  <p>This song is in the catalogue, but it does not have a playable YouTube source yet.</p>
                </div>
              ) : null}
              {error && track.youtubeVideoId ? (
                <div className="player-shell__fallback" role="status">
                  <img src={`https://i.ytimg.com/vi/${track.youtubeVideoId}/hqdefault.jpg`} alt="" />
                  <strong>Video unavailable here</strong>
                  <p>{error}</p>
                  {openOnYouTube ? <a href={openOnYouTube} target="_blank" rel="noreferrer">Open this video on YouTube ↗</a> : null}
                </div>
              ) : null}
            </div>

            <div className="player-shell__details">
              <div className="player-shell__track">
                <span className="player-shell__mode-label">{playbackMode === 'listen' ? 'Listening mode' : 'Now playing'}</span>
                <strong>{track.title}</strong>
                <span className="muted">{track.artistNames.length ? track.artistNames.join(', ') : 'Artist details coming soon'}</span>
              </div>
              {playbackMode === 'listen' && track.youtubeVideoId ? (
                <img className="player-shell__artwork" src={`https://i.ytimg.com/vi/${track.youtubeVideoId}/hqdefault.jpg`} alt={`Thumbnail for ${track.title}`} />
              ) : null}
              <TransportControls
                currentMs={currentMs}
                durationMs={durationMs}
                playbackState={playbackState}
                ready={ready}
                hasVideo={Boolean(track.youtubeVideoId)}
                volume={volume}
                muted={muted}
                playbackRate={playbackRate}
                shuffle={shuffle}
                repeatMode={repeatMode}
                queueLength={queue.length}
                isLastInQueue={queue[queue.length - 1]?.slug === track.slug}
                onSeek={seekTo}
                onPlayPause={playPause}
                onPrevious={previous}
                onNext={next}
                onToggleShuffle={toggleShuffle}
                onCycleRepeat={cycleRepeatMode}
                onVolume={changeVolume}
                onToggleMute={() => (muted ? playerRef.current?.unMute() : playerRef.current?.mute())}
                onRate={changeRate}
              />
              <div className="player-shell__secondary-controls">
                <button className="btn btn--sm" type="button" onClick={() => setQueueOpen(!queueOpen)} aria-expanded={queueOpen}>
                  Queue · {queue.length}
                </button>
                {openOnYouTube ? (
                  <a className="btn btn--sm" href={openOnYouTube} target="_blank" rel="noreferrer">YouTube ↗</a>
                ) : null}
              </div>
            </div>
          </div>
          {queueOpen ? (
            <QueueList
              queue={queue}
              currentSlug={track.slug}
              playbackState={playbackState}
              onSelect={(item) => play(item, queue, true)}
            />
          ) : null}
        </>
      ) : null}
      {!track ? (
        <div className="player-shell__video player-shell__video--empty">
          <div className="player-shell__empty">Choose a song to start listening with lyrics.</div>
        </div>
      ) : null}
    </section>
  );
}
