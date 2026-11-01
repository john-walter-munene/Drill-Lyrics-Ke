/**
 * Where to run the lyric line-sync estimate.
 *
 * The estimator in `@drillke/shared` is identical on both sides, so this module
 * only decides *which* side runs it. Browsers decode any format the platform
 * supports (MP3/M4A/Opus) with `AudioContext`; the server accepts WAV only.
 * Moderators on weak phones/tablets can therefore hand the work to the API —
 * the browser decodes the clip once, re-encodes it as mono 16 kHz WAV, and
 * uploads that.
 */

import { MAX_SYNC_LINES, type SyncResult } from '@drillke/shared';
import { encodeWav, UPLOAD_SAMPLE_RATE } from './wav';

/** Clips above this length are slow enough that a weak device should offload. */
export const LONG_CLIP_SECONDS = 240;
/** Upper bound for `navigator.hardwareConcurrency` considered "weak". */
export const LOW_CORE_COUNT = 4;
/** Device memory (GB) at or below which we treat the device as constrained. */
export const LOW_MEMORY_GB = 4;
/** Browser decode-to-mono is only attempted for files up to this size. */
export const MAX_LOCAL_DECODE_BYTES = 60 * 1024 * 1024;
/** Server upload limit per the API route (15 min of 16 kHz audio). */
export const MAX_SERVER_CLIP_SECONDS = 15 * 60;

export interface DeviceHints {
  cores?: number;
  memoryGb?: number;
  saveData?: boolean;
}

export interface ClipHints {
  durationSeconds: number;
  sizeBytes: number;
}

export type SyncRoute = 'browser' | 'server';

export interface RouteDecision {
  route: SyncRoute;
  reason: string;
}

/** Reads the browser hints once; undetectable values are left undefined. */
export function readDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
  };
}

/**
 * Pick browser or server estimation.
 *
 * Browser-first is the default: it keeps the audio on the device and the result
 * is immediate. A weak device, a long clip, data-saver mode or an oversized
 * file all move the work to the API. The caller may always override.
 */
export function chooseSyncRoute(clip: ClipHints, hints: DeviceHints = {}): RouteDecision {
  if (clip.sizeBytes > MAX_LOCAL_DECODE_BYTES) {
    return { route: 'server', reason: 'This file is too large to decode comfortably in the browser.' };
  }
  if (hints.saveData) {
    return { route: 'server', reason: 'Data-saver mode is on, so the clip is sent once to the server.' };
  }
  if (typeof hints.cores === 'number' && hints.cores <= LOW_CORE_COUNT) {
    return { route: 'server', reason: `This device reports ${hints.cores} cores; estimating on the server avoids a stall.` };
  }
  if (typeof hints.memoryGb === 'number' && hints.memoryGb <= LOW_MEMORY_GB) {
    return { route: 'server', reason: `This device reports ${hints.memoryGb} GB memory; the server will analyse the clip.` };
  }
  if (clip.durationSeconds > LONG_CLIP_SECONDS) {
    return { route: 'server', reason: 'Long clips take noticeably longer on a phone; the server is quicker here.' };
  }
  return { route: 'browser', reason: 'The clip can be analysed in this browser.' };
}

/** Whether a clip is short enough for the API upload route. */
export function fitsServerLimit(durationSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds <= MAX_SERVER_CLIP_SECONDS;
}



/**
 * Run the estimate on the API. The clip is decoded here (so any browser-
 * supported format works) and sent as WAV; the returned lines are the same
 * submission text the server re-parsed for itself.
 */
export async function estimateOnServer(
  apiUrl: string,
  submissionId: string,
  file: Blob,
  lineTexts: readonly string[],
): Promise<SyncResult> {
  if (lineTexts.length > MAX_SYNC_LINES) {
    return {
      ok: false,
      error: { code: 'TOO_MANY_LINES', message: `At most ${MAX_SYNC_LINES} lyric lines can be estimated at once.` },
    };
  }

  const samples = await decodeToMono(file, UPLOAD_SAMPLE_RATE);
  const wav = encodeWav(samples, UPLOAD_SAMPLE_RATE);
  const response = await fetch(
    `${apiUrl}/api/admin/lyrics/${encodeURIComponent(submissionId)}/sync-estimate`,
    {
      method: 'POST',
      headers: { 'content-type': 'audio/wav' },
      body: wav,
      credentials: 'include',
      cache: 'no-store',
    },
  );

  const body = await response.json().catch(() => null) as
    | (SyncResult & { message?: string | string[] })
    | { message?: string | string[] }
    | null;
  if (!response.ok) {
    const raw = body && 'message' in body ? body.message : undefined;
    const message = Array.isArray(raw) ? raw.join(' ') : raw ?? `Server estimation failed (${response.status}).`;
    throw new Error(message);
  }
  if (!body || !('ok' in body)) {
    throw new Error('The server returned an unreadable estimate.');
  }
  return body as SyncResult;
}

/** Read a File/Blob's audio duration without keeping the object URL alive. */
export async function measureAudio(file: Blob): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;
    const duration = await new Promise<number>((resolve, reject) => {
      const done = (value: number) => resolve(Number.isFinite(value) ? value : 0);
      audio.addEventListener('loadedmetadata', () => done(audio.duration), { once: true });
      audio.addEventListener('error', () => reject(new Error('This file is not audio the browser can read.')), { once: true });
      // Metadata read normally settles long before this; it only guards a hang.
      setTimeout(() => done(audio.duration), 4_000);
    });
    return duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Decode a file to mono PCM at the estimator's analysis rate using the browser's
 * own codecs. Only used when the on-device route is chosen.
 */
export async function decodeToMono(file: Blob, sampleRate = 16_000): Promise<Float32Array> {
  const bytes = await file.arrayBuffer();
  const context = new AudioContext({ sampleRate });
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
    }
    return mono;
  } finally {
    await context.close();
  }
}

