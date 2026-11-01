/**
 * Lyrics contract: the parsed representation plus the timestamp helpers the
 * player needs. The full authoring format is specified in
 * `docs/lyrics-format.md`.
 *
 * Shared parsing and timing helpers keep browser and API interpretation aligned.
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

/** Parse the simple text submission format. Timestamps are optional per line. */
export function parseLyricsText(body: string): LyricsParseResult {
  const errors: LyricsFieldErrors = {};
  if (body.length > 512 * 1024) {
    return { ok: false, errors: { body: ['Lyrics must be 512 KB or smaller.'] } };
  }
  const rawLines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return { ok: false, errors: { body: ['Enter at least one lyric line.'] } };
  }
  if (rawLines.length > MAX_LYRIC_LINES) {
    return { ok: false, errors: { body: [`Lyrics cannot exceed ${MAX_LYRIC_LINES} lines.`] } };
  }

  let lastTimestamp = -1;
  const lines: LyricLine[] = rawLines.map((raw, index) => {
    const match = /^(\[(?:(?:\d{2}):)?\d{2}:\d{2}\.\d{3}\])\s*(.*)$/.exec(raw);
    if (!match) return { index, startMs: -1, text: raw };
    const startMs = timestampToMs(match[1]);
    if (startMs == null) {
      errors.timestamps = [...(errors.timestamps ?? []), `Line ${index + 1} has an invalid timestamp.`];
      return { index, startMs: -1, text: match[2] };
    }
    if (startMs < lastTimestamp) {
      errors.timestamps = [...(errors.timestamps ?? []), `Line ${index + 1} timestamp moves backwards.`];
    }
    lastTimestamp = startMs;
    if (!match[2].trim()) errors.body = [...(errors.body ?? []), `Line ${index + 1} has a timestamp but no lyric text.`];
    return { index, startMs, text: match[2].trim() };
  });

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    lyrics: { syncStatus: isSynchronized(lines) ? 'synchronized' : 'unsynchronized', lines, annotations: [] },
  };
}

/** Limits for reviewer-authored annotations (see `docs/lyrics-format.md` §2). */
export const MAX_ANNOTATIONS = 100;
export const MAX_ANNOTATION_PHRASE = 80;
export const MAX_ANNOTATION_EXPLANATION = 2_000;

/**
 * Normalise and validate reviewer-authored annotations against the lines they
 * are published with. Phrase matching is case-insensitive and must resolve to a
 * real line, so an annotation can never drift from the lyrics it explains.
 *
 * When `lineIndex` is omitted the first matching line is used. Returns either
 * the resolved annotations (with 0-based `lineIndex` always set) or per-field
 * errors shaped like {@link LyricsFieldErrors} for a `422` response.
 */
export function resolveAnnotations(
  lines: readonly LyricLine[],
  input: readonly Annotation[],
): { ok: true; annotations: Annotation[] } | { ok: false; errors: LyricsFieldErrors } {
  const annotations: Annotation[] = [];
  const errors: string[] = [];
  if (input.length > MAX_ANNOTATIONS) {
    errors.push(`At most ${MAX_ANNOTATIONS} annotations can be published per version.`);
  }
  input.slice(0, MAX_ANNOTATIONS).forEach((candidate, position) => {
    const label = `Annotation ${position + 1}`;
    const phrase = (candidate.phrase ?? '').trim();
    const explanation = (candidate.explanation ?? '').trim();
    if (!phrase) {
      errors.push(`${label} needs a phrase copied from the lyrics.`);
      return;
    }
    if (phrase.length > MAX_ANNOTATION_PHRASE) {
      errors.push(`${label} phrase must be ${MAX_ANNOTATION_PHRASE} characters or fewer.`);
      return;
    }
    if (!explanation) {
      errors.push(`${label} needs an explanation.`);
      return;
    }
    if (explanation.length > MAX_ANNOTATION_EXPLANATION) {
      errors.push(`${label} explanation must be ${MAX_ANNOTATION_EXPLANATION} characters or fewer.`);
      return;
    }
    const needle = phrase.toLocaleLowerCase();
    const matches = (text: string) => text.toLocaleLowerCase().includes(needle);
    let lineIndex: number;
    if (candidate.lineIndex == null) {
      const found = lines.findIndex((line) => matches(line.text));
      if (found < 0) {
        errors.push(`${label} phrase “${phrase}” does not appear in the lyrics.`);
        return;
      }
      lineIndex = found;
    } else {
      const line = lines[candidate.lineIndex];
      if (!line) {
        errors.push(`${label} points at line ${candidate.lineIndex + 1}, which does not exist.`);
        return;
      }
      if (!matches(line.text)) {
        errors.push(`${label} phrase “${phrase}” does not appear on line ${candidate.lineIndex + 1}.`);
        return;
      }
      lineIndex = candidate.lineIndex;
    }
    annotations.push({ phrase, explanation, lineIndex });
  });
  return errors.length > 0 ? { ok: false, errors: { annotations: errors } } : { ok: true, annotations };
}

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
