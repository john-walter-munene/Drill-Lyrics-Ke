'use client';

import type { PlayerTrack, RepeatMode } from './PlayerProvider';

/**
 * The transport deck: seek bar, play/pause, skip, shuffle/repeat, volume, speed.
 *
 * Extracted from `PlayerSurface` so the YouTube lifecycle effect and the JSX for
 * the controls are readable separately — the surface had grown to cover both and
 * neither was easy to follow. Every control here is presentational: it calls a
 * prop and renders the state it is given, which is what makes the keyboard
 * shortcuts in the surface and the buttons here stay consistent.
 *
 * Accessibility notes (`docs/product.md` §5.1): every control has an accessible
 * name, the seek and volume sliders are real `input[type=range]`, and pressed
 * state on shuffle/repeat is `aria-pressed` rather than only a CSS class.
 */

export function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface TransportControlsProps {
  currentMs: number;
  durationMs: number;
  playbackState: 'playing' | 'paused' | 'buffering' | 'unstarted' | 'ended' | 'error';
  ready: boolean;
  hasVideo: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  queueLength: number;
  isLastInQueue: boolean;
  onSeek: (milliseconds: number) => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  onRate: (value: number) => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function TransportControls({
  currentMs,
  durationMs,
  playbackState,
  ready,
  hasVideo,
  volume,
  muted,
  playbackRate,
  shuffle,
  repeatMode,
  queueLength,
  isLastInQueue,
  onSeek,
  onPlayPause,
  onPrevious,
  onNext,
  onToggleShuffle,
  onCycleRepeat,
  onVolume,
  onToggleMute,
  onRate,
}: TransportControlsProps) {
  const playLabel = playbackState === 'playing' ? 'Pause' : 'Play';
  const playGlyph = playbackState === 'playing' ? 'Ⅱ' : playbackState === 'buffering' ? '…' : '▶';

  return (
    <div className="player-shell__transport" aria-label="Playback controls">
      <div className="player-shell__seek-row">
        <span>{formatTime(currentMs)}</span>
        <input
          aria-label="Seek song"
          type="range"
          min="0"
          max={Math.max(1, durationMs)}
          value={Math.min(currentMs, durationMs || 0)}
          disabled={!ready || !durationMs}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{durationMs ? formatTime(durationMs) : '--:--'}</span>
      </div>

      <div className="player-shell__transport-actions">
        <button
          className={`player-icon-button${shuffle ? ' is-active' : ''}`}
          type="button"
          onClick={onToggleShuffle}
          aria-pressed={shuffle}
          aria-label="Toggle shuffle"
          title="Shuffle"
        >
          ⤨
        </button>
        <button
          className="player-icon-button"
          type="button"
          onClick={() => (currentMs > 3000 ? onSeek(0) : onPrevious())}
          disabled={!ready}
          aria-label="Previous song or restart"
          title="Previous (P)"
        >
          ⏮
        </button>
        <button
          className="player-play-button"
          type="button"
          onClick={onPlayPause}
          disabled={!ready || !hasVideo}
          aria-label={playLabel}
          title="Play or pause (Space)"
        >
          {playGlyph}
        </button>
        <button
          className="player-icon-button"
          type="button"
          onClick={onNext}
          disabled={!queueLength || (repeatMode !== 'all' && isLastInQueue)}
          aria-label="Next song"
          title="Next (N)"
        >
          ⏭
        </button>
        <button
          className={`player-icon-button${repeatMode !== 'off' ? ' is-active' : ''}`}
          type="button"
          onClick={onCycleRepeat}
          aria-pressed={repeatMode !== 'off'}
          aria-label={`Repeat ${repeatMode}`}
          title={`Repeat: ${repeatMode}`}
        >
          {repeatMode === 'one' ? '↻¹' : '↻'}
        </button>
      </div>

      <div className="player-shell__secondary-controls">
        <label className="player-shell__volume">
          <button
            className="player-icon-button"
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? '◖' : '◖))'}
          </button>
          <input
            type="range"
            aria-label="Volume"
            min="0"
            max="100"
            value={Math.round(volume)}
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </label>
        <label className="player-shell__speed">Speed{' '}
          <select
            aria-label="Playback speed"
            value={playbackRate}
            onChange={(event) => onRate(Number(event.target.value))}
          >
            {PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export interface QueueListProps {
  queue: PlayerTrack[];
  currentSlug: string;
  playbackState: TransportControlsProps['playbackState'];
  onSelect: (track: PlayerTrack) => void;
}

/**
 * "Up next" list.
 *
 * The current track is marked with `aria-current`, matching the lyric view, so a
 * screen reader announces position in the queue rather than leaving it to the
 * `♫` glyph alone.
 */
export function QueueList({ queue, currentSlug, playbackState, onSelect }: QueueListProps) {
  return (
    <div className="player-shell__queue" aria-label="Playback queue">
      <div className="player-shell__queue-heading">
        <strong>Up next</strong>
        <span>{queue.length} songs</span>
      </div>
      <ol>
        {queue.map((item, index) => {
          const current = item.slug === currentSlug;
          return (
            <li key={item.slug} className={current ? 'is-current' : ''}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                aria-current={current ? 'true' : undefined}
              >
                <span className="player-shell__queue-index">
                  {current ? '♫' : String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.artistNames.length ? item.artistNames.join(', ') : 'Artist attribution pending'}</small>
                </span>
                {current ? (
                  <span className="player-shell__queue-playing">
                    {playbackState === 'playing' ? 'Playing' : 'Selected'}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
