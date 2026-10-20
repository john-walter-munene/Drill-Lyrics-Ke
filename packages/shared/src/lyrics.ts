/**
 * Lyrics contract: the parsed representation plus the timestamp helpers the
 * player needs. The full authoring format is specified in
 * `docs/lyrics-format.md`.
 *
 * Only the *types* and *pure helpers* live here in Phase 0. The Markdown parser
 * (`parseLyrics`) is Phase 1 work — see `docs/roadmap.md`.
 */

import type { SyncStatus } from './types.ts';

/** One timed (or untimed) lyric line. */
export interface LyricLine {
  /** 0-based position in the lyric body. */
  index: number;
  /** Milliseconds from the start of the track. `-1` when the line is untimed. */
  startMs: number;
  /** Derived from the next line when the source omitted it. */
  endMs?: number;
  text: string;
}

/** An explanation anchored to a phrase, optionally to a specific line. */
export interface Annotation {
  phrase: string;
  explanation: string;
  lineIndex?: number;
}

/** Parsed lyric body for one version of a song. */
export interface ParsedLyrics {
  syncStatus: SyncStatus;
  lines: LyricLine[];
  annotations: Annotation[];
}

/** The single payload the player fetches per song (see `docs/api.md`). */
export interface LyricsPayload extends ParsedLyrics {
  versionId: string;
}

export interface LyricsFieldErrors {
  [field: string]: string[];
}

export type LyricsParseResult =
  | { ok: true; lyrics: ParsedLyrics }
  | { ok: false; errors: LyricsFieldErrors };

/** `^[mm:ss.mmm]` or `^[hh:mm:ss.mmm]` at the start of a line. */
export const TIMESTAMP_PATTERN = /^\[(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\]/;

/** A YouTube video id is exactly 11 URL-safe characters. */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Line cap per submission — keeps payloads and renders bounded. */
export const MAX_LYRIC_LINES = 500;

/** `mm:ss.mmm` → milliseconds. Returns null on malformed input. */
export function timestampToMs(value: string): number | null {
  const match = TIMESTAMP_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, hh, mm, ss, mmm] = match;
  const hours = hh ? Number(hh) : 0;
  const minutes = Number(mm);
  const seconds = Number(ss);
  if (minutes > 59 || seconds > 59) return null;
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + Number(mmm);
}

/** Milliseconds → `mm:ss.mmm` (or `hh:mm:ss.mmm` past the first hour). */
export function msToTimestamp(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  const base = `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
  return hours > 0 ? `${pad(hours)}:${base}` : base;
}

/**
 * Index of the line active at `positionMs` — the last line whose `startMs` is
 * at or before the position. Standard closed-interval binary search, so the
 * player can call this on every frame without allocating.
 *
 * Returns `-1` before the first timestamp.
 */
export function findActiveLineIndex(
  lines: readonly LyricLine[],
  positionMs: number,
): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** True when every line carries a real timestamp (and there is at least one). */
export function isSynchronized(lines: readonly LyricLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.startMs >= 0);
}

/**
 * Fill in `endMs` from the following line's `startMs`. The final line is left
 * open-ended. Returns a new array; never mutates the input.
 */
export function withDerivedEnds(lines: readonly LyricLine[]): LyricLine[] {
  return lines.map((line, i) => {
    const next = lines[i + 1];
    if (line.endMs != null || !next || next.startMs < 0) return { ...line };
    return { ...line, endMs: next.startMs };
  });
}
