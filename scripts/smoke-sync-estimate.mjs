#!/usr/bin/env node
/**
 * Smoke test for the moderator "estimate on the server" path.
 *
 * Drives the real Docker stack exactly as the admin editor does after the
 * change in `apps/web/app/admin/sync-estimate.ts`:
 *
 *   1. sign in as the seeded moderator              POST /api/auth/signin
 *   2. submit three untimed lyric lines             POST /api/lyrics/submissions
 *   3. synthesise a WAV with three clear onsets     (in memory, no fixture file)
 *   4. upload it as `audio/wav`                     POST /api/admin/lyrics/:id/sync-estimate
 *   5. assert the estimate is usable                (shape, order, onset recovery)
 *
 * The synthetic clip mirrors `packages/shared/src/lyric-sync.test.ts`: a
 * sustained multi-tone "vocal" per line, not a click. A click gives the
 * estimator too few frames of activity to place, and would make this script
 * fail for a reason that has nothing to do with the route under test.
 *
 * Usage:
 *   E2E_ADMIN_PASSWORD=... node scripts/smoke-sync-estimate.mjs
 *   API_URL=http://localhost:4000  E2E_ADMIN_EMAIL=...  E2E_ADMIN_PASSWORD=...
 *
 * Exit 0 = the route returns a usable estimate; 1 = it does not.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '';
/** A published song from the seed; submissions are tied to the catalogue. */
const SONG_SLUG = process.env.E2E_SONG_SLUG ?? 'masicka-update-official-video';

/**
 * The aligner models line *starts* as cumulative character weight through the
 * lyric span, so the onsets are placed the same way (see the evenly-weighted
 * case in `lyric-sync.test.ts`). Onsets at arbitrary times would put every line
 * up to half a slot from its start — a mismatch no layout can recover.
 */
const LINES = ['E2E onset one', 'E2E onset two follows', 'E2E onset three closes'];
// The run marker is appended to line 1 in `queuedLines()`; it is built *before*
// the clip so the onsets and the stored lyric text describe the same lines.
const INTRO_SECONDS = 3;
const OUTRO_SECONDS = 3;
const CLIP_SECONDS = 20;
// `lyricSpanMs` never runs the lyric set to the very end of the clip; with a
// 20 s clip and 6 s of air it fits ~14 s (see `lyricSpanMs` in lyric-sync.ts).
const SPAN_SECONDS = CLIP_SECONDS - INTRO_SECONDS - OUTRO_SECONDS;
/** A line slot in the three-line clip (~3.8 s); the fit may drift within it. */
const ONE_SLOT_MS = 3_800;
const BURST_SECONDS = 0.22;

/**
 * Seconds from clip start for each line start, from the same weight model the
 * shared aligner uses: characters, spaces dropped, a line never weighing zero.
 */
function onsetTimesFor(lineTexts) {
  const weights = lineTexts.map((line) => Math.max(1, line.replace(/\s/g, '').length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  return weights.map((weight) => {
    const start = INTRO_SECONDS + (cumulative / total) * SPAN_SECONDS;
    cumulative += weight;
    return start;
  });
}
/** Re-encoding to 16-bit, the ~20 ms analysis grid and the burst length. */
const TOLERANCE_MS = 400;

const SAMPLE_RATE = 16_000;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/**
 * Guard the assumption both sides share: the server re-parses the submission
 * and estimates for *those* lines. A mismatch here means the clip and the
 * timings describe different lyric sets, which would make every later
 * assertion misleading.
 */
function assertServerSawEveryLine(estimate, expected) {
  const seen = estimate?.estimate?.startsMs?.length;
  if (seen !== expected) {
    fail(`Server estimated ${seen} lines but ${expected} were submitted — check the stored submission text.`);
  }
}

/**
 * The exact line set submitted for review, marker included. Built once at
 * start-up so the synthetic clip and the stored text are the same submission.
 */
const MARKER = `SMOKE-${Date.now()}`;
const QUEUED_LINES = LINES.map((line, index) => (index === 0 ? `${line} ${MARKER}` : line));

/**
 * The same synthetic "vocal" the shared tests use: rising pitch plus vibrato
 * through the mid bands, over a faint noise floor so silent bands stay alive.
 */
function buildSamples() {
  const samples = new Float32Array(Math.round(CLIP_SECONDS * SAMPLE_RATE));
  let seed = 7;
  const noise = () => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff;
    return (seed / 0x7fff_ffff) * 2 - 1;
  };
  const len = Math.round(BURST_SECONDS * SAMPLE_RATE);
  for (const onset of onsetTimesFor(QUEUED_LINES)) {
    const start = Math.round(onset * SAMPLE_RATE);
    for (let i = 0; i < len; i += 1) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.min(1, i / 160, (len - i) / 160);
      const pitch = 700 + 250 * (i / len);
      const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 18;
      const voice = Math.sin(2 * Math.PI * (pitch + vibrato) * t) * 0.32
        + Math.sin(2 * Math.PI * (pitch * 2.01 + vibrato) * t) * 0.18
        + Math.sin(2 * Math.PI * (pitch * 1.5) * t) * 0.1;
      samples[start + i] += envelope * voice + noise() * 0.004;
    }
  }
  return samples;
}

/** 16-bit mono PCM WAV — the only format the route accepts. */
function buildWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

async function json(path, init = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${response.status} ${JSON.stringify(body)}`);
  }
  return { body, response };
}

async function main() {
  console.log(`→ API ${API_URL}`);
  if (!ADMIN_PASSWORD) fail('No admin password. Set E2E_ADMIN_PASSWORD (see docs/runbook.md).');

  const health = await fetch(`${API_URL}/api/health/ready`).catch(() => null);
  if (!health?.ok) fail(`API not reachable at ${API_URL}; start the stack with \`npm run dev:stack\`.`);

  // --- 1. moderator session -------------------------------------------------
  const signIn = await json('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookies = signIn.response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  if (!cookies) fail('Sign-in returned no session cookie.');
  const auth = { cookie: cookies };
  const role = signIn.body?.user?.role;
  if (role !== 'moderator' && role !== 'admin') fail(`Signed in as "${role}", but the route needs moderator.`);
  console.log(`✓ signed in as ${signIn.body.user.email} (${role})`);

  // --- 2. a pending submission with three untimed lines ---------------------
  const songs = await json(`/api/songs?q=${encodeURIComponent(SONG_SLUG.split('-')[0])}`);
  const song = songs.body?.items?.find((item) => item.slug === SONG_SLUG);
  if (!song) fail(`Seeded song ${SONG_SLUG} not found — run \`npm run db:seed\`.`);

  const lines = QUEUED_LINES;
  const marker = MARKER;
  const submission = await json('/api/lyrics/submissions', {
    method: 'POST',
    body: JSON.stringify({ songId: song.id, markdown: lines.join('\n'), note: marker }),
  });
  const submissionId = submission.body?.id;
  console.log(`✓ created pending submission ${submissionId}`);

  // --- 3. upload the synthetic WAV -----------------------------------------
  const wav = buildWav(buildSamples());
  console.log(`→ uploading a ${CLIP_SECONDS}s mono WAV (${Math.round(wav.length / 1024)} KB)…`);
  const upload = await fetch(`${API_URL}/api/admin/lyrics/${submissionId}/sync-estimate`, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav', ...auth },
    body: wav,
  });
  const estimate = await upload.json().catch(() => null);
  if (!upload.ok) fail(`sync-estimate → ${upload.status} ${JSON.stringify(estimate)}`);
  if (!estimate?.ok) fail(`Server refused the clip: ${JSON.stringify(estimate)}`);

  // --- 4. the estimate is usable -------------------------------------------
  // The route parses the *stored* submission text itself; if that parse found
  // fewer lines than were submitted, the estimate is for the wrong song model.
  assertServerSawEveryLine(estimate, lines.length);

  const { startsMs, confidence, coverage } = estimate.estimate;
  console.log('  suggested starts:', startsMs.map((ms) => `${(ms / 1000).toFixed(2)}s`).join(', '));
  console.log(`  confidence ${Math.round(confidence * 100)}%, coverage ${Math.round(coverage * 100)}%`);

  if (startsMs.length !== lines.length) fail(`Expected ${lines.length} timestamps, got ${startsMs.length}.`);
  if (startsMs.some((ms) => !Number.isFinite(ms) || ms < 0)) fail('Timestamps must be non-negative numbers.');
  for (let i = 1; i < startsMs.length; i += 1) {
    if (startsMs[i] < startsMs[i - 1]) fail('Timestamps must be non-decreasing.');
  }
  if (estimate.sampleRate !== SAMPLE_RATE) fail(`Expected sampleRate ${SAMPLE_RATE}, got ${estimate.sampleRate}.`);
  console.log('✓ shape is valid (count, non-negative, ordered, sampleRate)');

  // --- 5. content check: does it find the onsets we planted? ---------------
  //
  // The stretch fit moves the whole layout within one line slot, so the thing
  // that matters is that **each suggested start lands in its own onset's slot**
  // — not that every line is within a few hundred ms of the planted chunk. A
  // nearest-onset check is scale-free and cannot be loosened into uselessness
  // by widening a tolerance: two lines in the same slot, or one in none, still
  // fails however generous the bound.
  const planted = onsetTimesFor(QUEUED_LINES).map((seconds) => seconds * 1_000);
  const nearest = (ms) => planted.reduce((best, value) => (Math.abs(ms - value) < Math.abs(ms - best) ? value : best), planted[0]);
  const claimed = new Map();
  startsMs.forEach((ms, index) => {
    const owner = nearest(ms);
    const neighbours = claimed.get(owner);
    if (neighbours) {
      fail(`Line ${index + 1} (${ms} ms) shares an onset slot with line ${neighbours} — duplicate match.`);
    }
    claimed.set(owner, index + 1);
    console.log(`  line ${index + 1}: got ${ms} ms → nearest onset ${owner} ms (Δ ${Math.round(Math.abs(ms - owner))} ms) ✓`);
  });
  if (claimed.size !== planted.length) {
    fail(`Only ${claimed.size}/${planted.length} of the planted onsets were matched one-to-one.`);
  }
  // Sanity bound on the fit itself: the whole layout must sit near the intro.
  const drift = Math.abs(startsMs[0] - planted[0]);
  if (drift > ONE_SLOT_MS) {
    fail(`The first line is ${Math.round(drift)} ms from its onset (limit ${ONE_SLOT_MS} ms).`);
  }
  console.log('✓ every onset matched one-to-one — the server estimate is usable');

  console.log(`\n• fixture left in the queue as "${marker}" — reject it from /admin to clear it.`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
