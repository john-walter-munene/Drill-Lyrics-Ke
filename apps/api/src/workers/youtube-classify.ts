/**
 * Which YouTube uploads are music?
 *
 * An artist channel's uploads playlist is not a discography: it holds vlogs,
 * interviews, freestyles, snippets, ads and "out now" teasers. This module
 * decides, from metadata the Data API already returns and for free, how much an
 * upload looks like a song or an audio release.
 *
 * Rules are deliberately conservative about the *positive* case and generous
 * about the *rejection* case:
 *
 *   - Rejected only for shapes that are never a canonical release: a #shorts
 *     clip, a live stream, a sub-minute teaser.
 *   - `audio` / `video` (imported) needs an explicit signal — a music category,
 *     a topic-style auto-generated title, or a duration inside the range of a
 *     song.
 *   - Anything else is kept as `unclear` rather than dropped. The cost of
 *     importing a non-song is one row an admin deletes; the cost of dropping a
 *     real song is a missing record nobody knows to add back.
 *
 * Pure functions only: no Prisma, no network, so this is unit-testable.
 */

export type UploadKind = 'audio' | 'video' | 'unclear' | 'rejected';

export interface ClassifiedUpload {
  kind: UploadKind;
  /** 0–1. Shown in the admin panel; never used as a filter by itself. */
  score: number;
  reasons: string[];
}

export interface UploadMetadata {
  title: string;
  /** Seconds; `null` when the API did not return one. */
  durationSeconds: number | null;
  /** YouTube's own category, e.g. "Music", "Entertainment". */
  category?: string | null;
  liveBroadcastContent?: 'none' | 'live' | 'upcoming' | null;
  /** Present when the upload belongs to a Topic channel / auto-generated art track. */
  topicChannel?: boolean;
  /**
   * When the upload was published. For a scheduled premiere this is the day it
   * went public, which is what distinguishes a released track from one that is
   * still waiting.
   */
  publishedAt?: string | null;
}

export const SHORT_MAX_SECONDS = 90;
/** Shorter than this is a clip, an ad or a sound bite — never a release. */
const MIN_SONG_SECONDS = 30;
/**
 * Longer than this is not a standard track, but drill freestyles, live sets
 * and cyphers run past ten minutes, so it is a soft signal, not a rejection.
 */
const MAX_SONG_SECONDS = 20 * 60;

/**
 * Titles that mark a video as something other than a standard release.
 * Matched case-insensitively as whole words so "Interview" cannot fire on a
 * song called "Interview" only when it is bracketed… it still can. The cost is
 * a wrong `rejected` only in the rare case, and `rejected` rows are never
 * imported, so only shapes YouTube itself treats specially are hard-rejected.
 */
const NON_MUSIC_TITLE = /\b(vlog|behind the scenes|bts|interview|podcast|reaction|tutorial|unboxing|advert|sponsored|announcement|trailer)\b/i;

/** Brackets that label a teaser rather than a release. */
const TEASER_TITLE = /[([{]\s*(teaser|snippet|preview|trailer)\s*[)\]}]/i;

/**
 * Social media captions and event/set announcements used as video titles. An
 * artist's uploads playlist is also where "VOM2OUR on the 11th", "Festival"
 * and "LIVE PART 1" sit, and those carry the Music category and sometimes a
 * song-length run time, so only the title shape tells them from a release.
 */
const CAPTION_TITLE = /#\w+|\b(pull up|drop(?:ping)? (?:today|this)|live (?:part|set|at|from)|festival)\b/i;

/** Topic channels title tracks as "Artist - Song", never with a dash-only separator alone. */
const OFFICIAL_AUDIO = /\b(official\s+(audio|music\s+video)|lyric\s+video|visualizer)\b/i;
const AUDIO_ONLY = /\b(audio|full\s+song|out\s+now|available\s+now)\b/i;

/**
 * Classify one upload.
 *
 * `isShortAllowed` exists because an admin can decide shorts ARE part of the
 * catalogue; the classifier reports the shape either way and the caller decides.
 */
export function classifyUpload(meta: UploadMetadata): ClassifiedUpload {
  const title = meta.title.trim();
  const reasons: string[] = [];
  const seconds = meta.durationSeconds;

  // --- Hard rejections: shapes YouTube itself treats as not-a-release. -------

  if (meta.liveBroadcastContent === 'live') {
    return { kind: 'rejected', score: 0, reasons: ['live stream'] };
  }
  if (meta.liveBroadcastContent === 'upcoming') {
    // A scheduled premiere or stream. It is a real upload that simply has not
    // gone live yet, so it is reported separately from clips and shorts — and
    // when a `publishedAt` is known, that date settles it: YouTube keeps
    // `liveBroadcastContent: 'upcoming'` on a premiere whose scheduled time has
    // already passed, which is how a released song stayed out of the catalogue.
    const premieredAt = meta.publishedAt ? Date.parse(meta.publishedAt) : Number.NaN;
    if (!Number.isFinite(premieredAt) || premieredAt > Date.now()) {
      return { kind: 'rejected', score: 0, reasons: ['live stream'] };
    }
    reasons.push('scheduled upload, now published');
  }
  if (/#shorts?\b/i.test(title)) {
    return { kind: 'rejected', score: 0, reasons: ['YouTube Short'] };
  }
  if (seconds !== null && seconds > 0 && seconds < MIN_SONG_SECONDS) {
    return { kind: 'rejected', score: 0, reasons: ['shorter than 30 seconds'] };
  }
  if (seconds !== null && seconds < SHORT_MAX_SECONDS) {
    // A vertical clip only if the title says so; see above.
    reasons.push('under 90 seconds');
  }

  // --- Positive signals. -----------------------------------------------------

  let score = 0;
  if (meta.category?.toLowerCase() === 'music') { score += 0.5; reasons.push('YouTube category: Music'); }
  if (meta.topicChannel) { score += 0.4; reasons.push('Topic channel'); }
  if (OFFICIAL_AUDIO.test(title)) { score += 0.3; reasons.push('official audio / visualiser'); }
  if (AUDIO_ONLY.test(title)) { score += 0.1; reasons.push('audio release wording'); }
  if (seconds !== null && seconds >= MIN_SONG_SECONDS && seconds <= MAX_SONG_SECONDS) {
    score += 0.3;
    reasons.push('song-length run time');
  }
  if (NON_MUSIC_TITLE.test(title)) { score -= 0.5; reasons.push('non-music wording'); }
  if (CAPTION_TITLE.test(title)) { score -= 0.5; reasons.push('social media caption'); }
  if (TEASER_TITLE.test(title)) { score -= 0.4; reasons.push('teaser / snippet'); }
  if (seconds !== null && seconds > MAX_SONG_SECONDS) { score -= 0.3; reasons.push('longer than 20 minutes'); }

  score = Math.max(0, Math.min(1, score));

  // --- Verdict. --------------------------------------------------------------

  if (score >= 0.5) return { kind: 'audio', score, reasons };
  if (score >= 0.25) return { kind: 'video', score, reasons };
  return { kind: 'unclear', score, reasons };
}

/** Display duration for a playlist/videos response. */
export function parseIsoDuration(value?: string | null): number | null {
  if (!value) return null;
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  const [, d, h, m, s] = match;
  const total = Number(d ?? 0) * 86_400 + Number(h ?? 0) * 3_600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return Number.isFinite(total) ? total : null;
}
