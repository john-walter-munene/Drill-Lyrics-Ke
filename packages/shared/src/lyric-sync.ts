/**
 * Line-sync estimation for lyric timing.
 *
 * This is the pure half of the timing editor: given a decoded mono audio clip
 * containing the whole song and an ordered list of lyric lines, it estimates a
 * timestamp for each line from the vocal activity in the clip.
 *
 * The same code runs in two places:
 *   - in the browser, as a Web Worker (fast machines, no upload);
 *   - inside the API, for clients whose hardware cannot afford the analysis
 *     (slow phones/tablets) — `POST /api/admin/lyrics/:id/sync-estimate`.
 *
 * Keep it environment-free: input is `Float32Array` in, typed result out. No
 * DOM, no Node, no network.
 *
 * ## Model
 *
 * `estimateActivity` (after Liu, *Online Synchronization of Music and Lyrics*)
 * scores each audio frame by how far the energy in the vocal bands moves
 * relative to the bass/low band. Singing shifts energy into the mid/high bands
 * and pushes those bands to their own moving average, so the curve peaks on
 * vocal onsets rather than on the beat.
 *
 * Bands are compared pair by pair (bass→low-mid, low-mid→vocal, vocal→high).
 * Comparing only *adjacent* bands is what makes the score depend on the
 * spectrum and not on the overall level: a spoken or sung phrase moves energy
 * into the vocal band and then leaves, which lights up both sides of the vocal
 * band. Comparing the outermost pair instead (bass vs. high) barely reacts when
 * a formant lands in the middle band, because both outer bands are quiet
 * whenever there is no voice.
 *
 * `anchorLines` then finds the offset at which the vocal *events* line up with
 * the lyric lines. The activity curve's rising crossings are collapsed into one
 * event per phrase (a sung line wobbles up and down over several frames; only
 * its first rise is the onset). The lyric set is laid over the clip from a
 * candidate first-line start — line k owns `[start_k, start_{k+1})`, weighted by
 * character count — and every event is assigned to the line whose window owns
 * its time.
 *
 * A candidate is scored on the one-to-one match it produces: lines that
 * received exactly one onset in their window (+1), lines that received two or
 * more (-1 each), and lines that received none (-1). Dividing by the line
 * count caps a perfect match at 1.0 and keeps the score independent of how
 * many events the clip contains, which is what `confidence` reports.
 *
 * The score only changes when an onset crosses a slot boundary, so most
 * neighbouring offsets tie. The plateau is a range of equally valid answers,
 * and the estimate reports its centre rather than an edge — an edge would be
 * biased late by up to half a slot.
 *
 * Four rules keep the search from winning on a partial fit:
 *  - the first line cannot start before the clip does, so the search is `[0,
 *    maxShift]` — a negative offset was never a timestamp, only an artefact of
 *    a score that rewarded a ramp sliding off the quiet start of a song;
 *  - the last line must start far enough from the clip end to hold a phrase
 *    (`ML_TURN_MS`), so the lyrics cannot be compressed into the outro;
 *  - a candidate that explains fewer than two thirds of the clip's onsets is
 *    not an alignment, it is a corner of the search where a handful of quiet
 *    events happen to sit next to a line;
 *  - offset and *stretch* are fitted together (`STRETCHES`). A lyric set that
 *    fills 28 s of a 32 s clip fits one candidate exactly and every other with
 *    error growing towards the ends; fitting the offset alone would let a
 *    candidate compress its error away and win for the wrong reason.
 *
 * One global shift is a deliberate simplification: it assumes the whole vocal
 * track was placed into the video at a single offset, which is true for a
 * music video but can drift for a clip stitched together from different takes.
 * `confidence` reports how clean the match was, so a reviewer knows whether to
 * trust it.
 *
 * The estimate is a **starting point for a human reviewer**, never a
 * published timestamp. See `docs/lyrics-format.md` §7.
 *
 * ## Unknowns
 *
 * Neither the intro nor the outro is known: a lyric list without timestamps
 * says nothing about how long the gap before the first line, or after the last,
 * is. The estimator therefore fits offset and span together over a bounded
 * range and distributes lines by character length within that span. A clip with
 * a long instrumental outro is fitted by compressing the span; an outro longer
 * than the range allows is reported as low `confidence`. Reviewers see the
 * assumption in the editor and adjust the last few lines; `coverage` reports
 * how much of the clip the fit used.
 */

/** Analysis window: 64 ms at 16 kHz. Harmonic enough for band separation. */
export const DEFAULT_FFT_SIZE = 1024;
/** 20 ms hop at 16 kHz — matches typical 50 fps lyric video edits. */
export const DEFAULT_HOP = 320;
export const DEFAULT_SAMPLE_RATE = 16_000;
/** Band edges (Hz). Three vocal-vs-bass comparisons are summed. */
export const BAND_EDGES: readonly [number, number, number, number] = [60, 300, 3000, 6000];
/** Centred moving average over three frames (60 ms) — removes one-frame spikes. */
export const SMOOTHING_FRAMES = 3;
/** No alignment offset is more plausible than this. */
export const MAX_SHIFT_SECONDS = 8;
/** Resolution of the offset search. */
export const SHIFT_STEP_SECONDS = 0.01;
/** Two vocal onsets closer than this are the same phrase, not two lines. */
export const MIN_EVENT_GAP_MS = 400;

/**
 * How far a vocal onset may sit from its line's start and still count as that
 * line, as a fraction of that line's own slot. A line that owns 3.5 s of song
 * is sung for most of it, so an onset 500 ms in is still its opening; a line
 * that owns 0.5 s cannot be 500 ms from its start and remain a line. A fixed
 * window either rejects real phrases in long lines or lets a stretched layout
 * claim its neighbours' onsets — both show up as a flat landscape where the
 * winning offset is arbitrary.
 */
export const ONSET_SLACK = 0.15;

/**
 * How long a slot needs, at minimum, to hold a sung phrase. A candidate whose
 * lyric set would give its lines less than this cannot be right: the lyrics
 * would be over before the song's vocals were.
 *
 * Note this is a per-*slot* floor, not a per-line one — a candidate layout is
 * rejected on the smallest slot it creates, not on the average. The synthetic
 * ``evenly weighted'' test has five lines in 20 s with the last line at 18 s, so
 * its final line only spans 2 s; at 1 s/slot a 10 s offset survived because all
 * its slots were long. 1.5 s keeps the physically impossible layouts out while
 * still allowing tight, fast-spoken verses.
 */
export const ML_TURN_MS = 1_500;

export interface SyncAudio {
  /** Mono PCM in [-1, 1]. */
  samples: Float32Array | number[];
  /** Sample rate in Hz. Resample to {@link DEFAULT_SAMPLE_RATE} before calling. */
  sampleRate: number;
}

export interface SyncOptions {
  /** Frame size for the activity analysis. Must be ≥ 2 × max(BAND_EDGES). */
  fftSize?: number;
  /** Longest offset, in seconds, searched in either direction. */
  maxShiftSeconds?: number;
  /** Offset search step, in seconds. */
  stepSeconds?: number;
}

export interface SyncSettings {
  fftSize: number;
  hop: number;
  sampleRate: number;
  shiftStepSeconds: number;
  maxShiftSeconds: number;
}

export interface ActivityCurve {
  /** One normalised value per frame, in [0, 1]. */
  values: Float32Array;
  /** Frame hop in milliseconds. */
  hopMs: number;
  /** Clip length the curve was computed from, in milliseconds. */
  durationMs: number;
}

export interface SyncEstimate {
  /**
   * Suggested start, ms, per input line. Same order and length as the input.
   * Always non-negative and non-decreasing.
   */
  startsMs: number[];
  /** Start of the first line in the video, ms — the offset the search settled on. */
  shiftMs: number;
  /** The alignment score behind `confidence`, before rounding and clamping. */
  score: number;
  /**
   * 0–1. The share of lyric lines the winning layout matched one-to-one — a
   * line with exactly one onset in its opening, minus lines with none or with
   * two — over the line count. 1 is a clean match; around 0.15 or lower means
   * the audio is probably not aligned to this lyric set (or the clip is only an
   * excerpt): time it by hand.
   */
  confidence: number;
  /**
   * Share of the clip the fitted lyric span occupies, 0–1. The fit chooses the
   * span, so this reports the intro and outro it left out rather than assuming
   * the lyrics run to the end.
   */
  coverage: number;
  settings: SyncSettings;
  /** Wall-clock milliseconds spent on the estimate. */
  elapsedMs: number;
}

export interface SyncError {
  code: 'CLIP_TOO_SHORT' | 'TOO_MANY_LINES' | 'NO_ACTIVITY';
  message: string;
}

export type SyncResult = { ok: true; estimate: SyncEstimate } | { ok: false; error: SyncError };

/** Clip shorter than this cannot hold a lyric set. */
export const MIN_CLIP_MS = 2_000;
/** More lines than this is not a song; keeps the search bounded. */
export const MAX_SYNC_LINES = 500;
/** In-frame RMS below this counts as silence. */
const SILENCE_RMS = 1e-4;

/**
 * Full pipeline: audio in, one start time per line out.
 *
 * `lines` is treated as an ordered set of lyric starts. Equal or `-1` starts
 * are allowed (the caller is usually a set of untimed lines, whose order alone
 * matters), so pass them in authoring order.
 */
export function alignLyrics(
  audio: SyncAudio,
  lineTexts: readonly string[],
  options: SyncOptions = {},
): SyncResult {
  const started = now();
  const settings = resolveSettings(audio.sampleRate, options);
  const durationMs = audio.samples.length / audio.sampleRate * 1_000;

  if (lineTexts.length === 0) {
    return { ok: false, error: { code: 'TOO_MANY_LINES', message: 'Add at least one lyric line before estimating timings.' } };
  }
  if (lineTexts.length > MAX_SYNC_LINES) {
    return { ok: false, error: { code: 'TOO_MANY_LINES', message: `At most ${MAX_SYNC_LINES} lyric lines can be estimated at once.` } };
  }
  if (durationMs < MIN_CLIP_MS) {
    return { ok: false, error: { code: 'CLIP_TOO_SHORT', message: `Audio is too short (${Math.round(durationMs)} ms) to estimate lyric timings.` } };
  }

  const curve = estimateActivity(audio, options);
  if (!curve.ok) return curve;
  const estimate = anchorLines(curve.curve, lineTexts, settings);
  if (!estimate) {
    return { ok: false, error: { code: 'NO_ACTIVITY', message: 'This clip has no distinguishable vocal activity. Time the lyrics by hand.' } };
  }
  return { ok: true, estimate: { ...estimate, settings, elapsedMs: Math.round(now() - started) } };
}

export function resolveSettings(sampleRate: number, options: SyncOptions = {}): SyncSettings {
  const fftSize = Math.max(256, Math.round(options.fftSize ?? DEFAULT_FFT_SIZE));
  // Hop is tied to the sample rate so the analysis grid stays ~20 ms.
  const hop = Math.max(64, Math.round(sampleRate * DEFAULT_HOP / DEFAULT_SAMPLE_RATE));
  return {
    fftSize,
    hop,
    sampleRate,
    shiftStepSeconds: Math.min(0.1, Math.max(0.001, options.stepSeconds ?? SHIFT_STEP_SECONDS)),
    maxShiftSeconds: Math.max(0, Math.min(30, options.maxShiftSeconds ?? MAX_SHIFT_SECONDS)),
  };
}

/**
 * Audio levels are band energies, which decay like 1/f (and more for the bass
 * band). Comparing raw levels therefore favours onsets over sustained voice, so
 * each band is normalised by its own mean and each level is compressed with
 * `log1p(x) / log1e` before differencing.
 */
const LEVEL_SCALE = Math.log(1 + Math.E);

/**
 * Vocal-activity curve for a clip.
 *
 * For each frame compute the energy in four bands, normalise each band by its
 * own mean, and sum `|next - current| ^ p` across the three band pairs for
 * `p ∈ {1, 3, 5}`. Power orders emphasise the sharp onsets that power 1 alone
 * smooths away, and the normalisation lets a sustained vocal keep scoring well
 * after the band means have settled. The result is smoothed over three frames
 * and normalised so the 99.5th percentile is 1 (robust against one loud drop).
 */
export function estimateActivity(
  audio: SyncAudio,
  options: SyncOptions = {},
): { ok: true; curve: ActivityCurve } | { ok: false; error: SyncError } {
  const { samples, sampleRate } = audio;
  const { fftSize, hop } = resolveSettings(sampleRate, options);
  const count = samples.length >= fftSize ? 1 + Math.floor((samples.length - fftSize) / hop) : 0;
  if (count < 2) {
    return { ok: false, error: { code: 'CLIP_TOO_SHORT', message: 'Audio is too short to analyse.' } };
  }
  const durationMs = samples.length / sampleRate * 1_000;

  const window = blackman(fftSize);
  const windowSum = window.reduce((sum, value) => sum + value, 0);
  const binHz = sampleRate / fftSize;
  const bandBins = bandBinRanges(fftSize, binHz);
  const bands = bandBins.map(() => new Float64Array(count));

  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const magnitudes = new Float64Array(fftSize / 2 + 1);

  let silenceFrames = 0;
  for (let frame = 0; frame < count; frame += 1) {
    const offset = frame * hop;
    let sumSquares = 0;
    for (let i = 0; i < fftSize; i += 1) {
      const value = samples[offset + i] ?? 0;
      sumSquares += value * value;
      re[i] = value * window[i];
      im[i] = 0;
    }
    if (Math.sqrt(sumSquares / fftSize) < SILENCE_RMS) silenceFrames += 1;
    fft(re, im);
    magnitudes[0] = Math.abs(re[0]) / fftSize;
    for (let k = 1; k < fftSize / 2 + 1; k += 1) {
      magnitudes[k] = (2 * Math.hypot(re[k], im[k])) / fftSize;
    }
    for (let band = 0; band < bandBins.length; band += 1) {
      const [lo, hi] = bandBins[band];
      let sum = 0;
      for (let k = lo; k < hi; k += 1) sum += magnitudes[k];
      bands[band][frame] = sum / windowSum;
    }
  }
  if (silenceFrames === count) {
    return { ok: false, error: { code: 'NO_ACTIVITY', message: 'The clip is silent.' } };
  }

  // Normalise each band by its mean, so loud bass cannot dominate the score
  // and a silence-only floor does not collapse the ratio to one.
  const normalised = bands.map((band) => {
    let mean = 0;
    for (let i = 0; i < band.length; i += 1) mean += band[i];
    mean /= band.length;
    const safe = Math.max(mean, 1e-9);
    const result = new Float64Array(band.length);
    for (let i = 0; i < band.length; i += 1) result[i] = Math.log1p(band[i] / safe) / LEVEL_SCALE;
    return result;
  });

  const raw = new Float64Array(count);
  for (let frame = 0; frame < count; frame += 1) {
    let score = 0;
    for (let band = 0; band + 1 < normalised.length; band += 1) {
      const next = normalised[band + 1][frame];
      const current = normalised[band][frame];
      const delta = Math.abs(next - current);
      score += delta + delta ** 3 + delta ** 5;
    }
    raw[frame] = score;
  }

  const smoothed = movingAverage(raw, SMOOTHING_FRAMES);
  const peak = percentile(smoothed, 0.995);
  const scale = peak > 0 ? 1 / peak : 0;
  const values = new Float32Array(count);
  for (let i = 0; i < count; i += 1) values[i] = Math.min(1, Math.max(0, smoothed[i] * scale));

  return { ok: true, curve: { values, hopMs: hop / sampleRate * 1_000, durationMs } };
}

/**
 * Find the best global offset between a line ramp and the activity curve.
 * Exported for tests and for callers that already hold a curve.
 */
export function anchorLines(
  curve: ActivityCurve,
  lineTexts: readonly string[],
  settings: SyncSettings,
): Omit<SyncEstimate, 'settings' | 'elapsedMs'> | null {
  const weights = lineWeights(lineTexts);
  const count = curve.values.length;
  if (count < 2 || weights.length === 0) return null;

  // Crossing events, not frame samples: every rise of the activity curve is one
  // vocal event, and frame count tells nothing about loudness. Spreading one
  // burst over four consecutive frames must not count four times more than a
  // burst that one frame happened to catch.
  const crossings = zeroCrossings(curve.values, curve.hopMs);
  if (crossings.length === 0) return null;

  const step = settings.shiftStepSeconds;
  // A line cannot start before the clip does, so the first line's start is the
  // search bound: `[0, maxShift]`, where the default 8 s is the most plausible
  // intro a reviewer would want pre-filled.
  const maxSteps = Math.floor(settings.maxShiftSeconds / step);

  // Sweep the first line's start. For each candidate the lines are laid over
  // the clip from that start to the end of the clip — line k begins at its
  // cumulative character weight and owns the time until line k+1 — and each
  // vocal event is assigned to the line whose window owns its time. A correct
  // offset gives a one-to-one match: one event, one line, each event inside its
  // own line's window. A wrong offset either leaves a line with no event, or
  // puts two events on one line. That is what the score counts, and it is
  // scale-free: it does not matter how loud a burst is, only where it falls.
  //
  // The search also picks the *stretch*, not only the offset. A lyric set that
  // occupies 28 s of a 32 s clip fits one candidate exactly and every other
  // candidate with error growing towards the ends, so the offset and the
  // stretch have to be fitted together or the winner is whichever candidate
  // happens to compress its error away. `STRETCHES` spans a compressed outro to
  // a compressed intro; the clip-length assumption sits in the middle.
  //
  // A 5-minute clip has hundreds of events and 8 s at 10 ms is 801 candidates,
  // so the sweep is event-count × candidates × stretches — still far below the
  // frame-level cost of the activity analysis itself.
  const candidates: { shiftMs: number; spanMs: number; score: number }[] = [];
  for (let stepIndex = 0; stepIndex <= maxSteps; stepIndex += 1) {
    const startMs = Math.round(stepIndex * step * 1_000);
    for (const stretch of STRETCHES) {
      const spanMs = lyricSpanMs(startMs, curve.durationMs) * stretch;
      const score = scoreCandidate(crossings, weights, startMs, spanMs, curve);
      if (score == null) continue;
      candidates.push({ shiftMs: startMs, spanMs, score });
    }
  }
  if (candidates.length === 0) return null;

  // Ties are the norm, not the exception: the score only moves when an onset
  // crosses a slot boundary, so every offset inside one plateau scores the
  // same. The plateau is a *range* of valid answers, so report its centre
  // rather than whichever end the sweep happened to visit first — otherwise
  // the estimate is biased late by up to half a slot, which is exactly the
  // error a reviewer would have to correct by hand.
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0].score;
  const winners = candidates.filter((candidate) => candidate.score === top);
  const best = {
    shiftMs: Math.round(winners.reduce((sum, candidate) => sum + candidate.shiftMs, 0) / winners.length),
    spanMs: winners.reduce((sum, candidate) => sum + candidate.spanMs, 0) / winners.length,
    score: top,
  };
  const confidence = clamp(best.score, 0, 1);

  const shiftMs = best.shiftMs;
  const spanMs = best.spanMs;
  const totals = weights.reduce((sum, value) => sum + value, 0) || 1;
  const startsMs: number[] = [];
  let cumulative = 0;
  for (const weight of weights) {
    startsMs.push(Math.round(shiftMs + (cumulative / totals) * spanMs));
    cumulative += weight;
  }

  // Coverage: how much of the clip the lyric set was assumed to fill. Both the
  // intro and the outro this model left unexplained are subtracted, so a large
  // offset reads as low coverage rather than as "most of the clip used".
  const coverage = spanMs / curve.durationMs;

  return {
    startsMs,
    shiftMs,
    score: Math.round(best.score * 1_000) / 1_000,
    confidence: Math.round(confidence * 1_000) / 1_000,
    coverage: Math.round(clamp(coverage, 0, 1) * 1_000) / 1_000,
  };
}

/**
 * Span multipliers searched alongside the offset. The middle value is the
 * model's own assumption — lyrics run to the end of the clip — and the outer
 * values let a clip with a long outro or a long intro still fit, which a
 * single span cannot. Five values keep the sweep within 5 × its old cost.
 */
const STRETCHES: readonly number[] = [0.8, 0.9, 1, 1.1, 1.2];

/**
 * Score one candidate first-line start and lyric span.
 *
 * A constant offset means every line start slides together, so the question is
 * only *where the line layout sits* on the clip. Each frame is assigned to the
 * line slot that owns its shifted time, or to no line at all, and the activity
 * is split into three buckets. Each vocal event (one rising crossing of the
 * activity curve) is assigned to the line whose window owns its time.
 *
 * The score counts four things, all scale-free:
 *   - `+ inside`   — events that fall inside *some* line, within the turning
 *                    time of that line's start;
 *   - `- late`     — events inside the lyric set but after a line's turning
 *                    window, i.e. in the gap between two lines;
 *   - `- doubled`  — lines that received more than one event. Lyrics are one
 *                    onset per line; a layout that packs two on one line is
 *                    not right;
 *   - `- missing`  — lines that received no event at all.
 *
 * Dividing by the number of events caps the score at 1.0 for a perfect
 * one-to-one alignment and keeps it independent of how many events the clip
 * has, while the penalties stay *per event* rather than per line — so a layout
 * that explains its events well wins even when the lyric text has more lines
 * than this clip contains (an excerpt, or a section the analyst only has the
 * hook for). Because frame count plays no part, a burst spread over four frames
 * cannot out-vote a burst the analysis caught in one.
 *
 * Returns null when the span is empty (a start at or past the clip end).
 */
function scoreCandidate(
  crossings: Float64Array,
  weights: Float64Array,
  startMs: number,
  spanMs: number,
  curve: ActivityCurve,
): number | null {
  const spanSec = spanMs / 1_000;
  if (spanSec <= 0) return null;
  if (startMs + spanMs > curve.durationMs + 1) return null;

  const startSec = startMs / 1_000;
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  // Line k starts at `starts[k]` of the way through the lyric set, and its slot
  // runs to the next start (the last to the end of the clip). Line 1 owns from
  // the offset itself: the reviewer's first line is the first thing sung, so a
  // 2 s intro must not push its onset into line 2's slot.
  const starts = new Float64Array(weights.length);
  let running = 0;
  for (let k = 0; k < weights.length; k += 1) {
    starts[k] = k === 0 ? 0 : running / total;
    running += weights[k];
  }
  // The same asymmetry at the end. A line's slot must hold a sung phrase
  // (`ML_TURN_MS`); if a candidate would give its last line less than its share
  // of the remaining time, it is sliding the whole set off the front of the
  // vocals rather than aligning it, and is not a candidate at all.
  const expectedLastStart = starts.length > 1
    ? starts[starts.length - 2] + weights[weights.length - 2] / total
    : 0;
  if ((1 - expectedLastStart) * spanSec < ML_TURN_MS / 1_000) return null;

  const hits = new Float64Array(weights.length);
  let outside = 0;
  for (let e = 0; e < crossings.length; e += 1) {
    const position = (crossings[e] - startSec) / spanSec;
    if (position < 0 || position >= 1) {
      outside += 1;
      continue;
    }
    let k = 0;
    while (k + 1 < starts.length && starts[k + 1] <= position) k += 1;

    // An onset starts its line when it falls in the head of the line's slot, so
    // every line is an onset and not an arbitrary point inside a phrase. The
    // window is a share of the slot: long lines are sung for longer, so their
    // openings tolerate more lateness; short lines tolerate less.
    const offsetMs = (position - starts[k]) * spanSec * 1_000;
    const slotMs = (k + 1 < starts.length ? starts[k + 1] - starts[k] : 1 - starts[k]) * spanSec * 1_000;
    if (offsetMs <= slotMs * ONSET_SLACK) hits[k] += 1;
  }

  // One-to-one is the target: every line gets exactly one onset. A line with
  // two has packed a phrase onto a line that is already sung; a line with none
  // claims a moment where nobody sang.
  let matched = 0;
  let missing = 0;
  let doubled = 0;
  for (let k = 0; k < hits.length; k += 1) {
    if (hits[k] === 1) matched += 1;
    else if (hits[k] === 0) missing += 1;
    else doubled += 1;
  }

  // A layout that leaves most of the clip's onsets outside the lyric set is not
  // an alignment. Without this the sweep prefers the corner where a few quiet
  // events sit beside a line over the real chorus, because the events it fails
  // to see are not penalised at all.
  if (outside > crossings.length / 3) return null;

  return (matched - missing - doubled) / weights.length;
}

/**
 * Frames at which the activity curve rises, i.e. where a line is about to be
 * sung. Returning times rather than frame indices keeps this independent of the
 * hop rate: the caller converts a crossing time straight into a position in the
 * lyric set.
 */
function zeroCrossings(values: Float32Array, hopMs: number): Float64Array {
  const hopSec = hopMs / 1_000;
  const times: number[] = [];
  // Rising crossings, then collapsed: a single sung phrase wobbles up and down
  // over several frames, and only its first rise is the onset. Two rises closer
  // than MIN_EVENT_GAP_MS are one event.
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[i - 1] && values[i] > 0.05) {
      const t = i * hopSec;
      if (times.length === 0 || t - times[times.length - 1] >= MIN_EVENT_GAP_MS / 1_000) times.push(t);
    }
  }
  return new Float64Array(times);
}

/**
 * Millisecond span the lyric set is assumed to occupy: from the first line's
 * start to the end of the clip, before the search's stretch factor is applied.
 * Exported so tests and callers reason about the same span the aligner fits.
 */
export function lyricSpanMs(shiftMs: number, clipDurationMs: number): number {
  return Math.max(0, clipDurationMs - shiftMs);
}

/**
 * Distribute the timeline across lines by character count (spaces ignored), so
 * a four-word line gets roughly twice the span of a two-word line. Returns
 * weights summing to 1; never all zero for a non-empty list.
 */
export function lineWeights(lineTexts: readonly string[]): Float64Array {
  const weights = new Float64Array(lineTexts.length);
  let total = 0;
  lineTexts.forEach((text, index) => {
    const weight = Math.max(1, text.replace(/\s+/g, '').length);
    weights[index] = weight;
    total += weight;
  });
  if (total > 0) for (let i = 0; i < weights.length; i += 1) weights[i] /= total;
  return weights;
}

function bandBinRanges(fftSize: number, binHz: number): [number, number][] {
  const edges = [BAND_EDGES[0], BAND_EDGES[1], BAND_EDGES[2], BAND_EDGES[3], binHz * (fftSize / 2)];
  const ranges: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i += 1) {
    const lo = Math.max(0, Math.floor(edges[i] / binHz));
    const hi = Math.min(fftSize / 2 + 1, Math.max(lo + 1, Math.ceil(edges[i + 1] / binHz)));
    ranges.push([lo, hi]);
  }
  return ranges;
}

function blackman(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    const x = (2 * Math.PI * i) / (size - 1);
    window[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
  }
  return window;
}

/** Iterative radix-2 Cooley–Tukey FFT, in place. `size` must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

function movingAverage(values: Float64Array, size: number): Float64Array {
  const n = values.length;
  const radius = Math.floor(size / 2);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(n - 1, i + radius); k += 1) {
      sum += values[k];
      count += 1;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

function percentile(values: Float64Array, q: number): number {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  // `TypedArray#sort` is numeric, unlike the Array default (lexicographic).
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `performance` in browsers/workers; `Date` where DOM types are absent (API). */
function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
}

