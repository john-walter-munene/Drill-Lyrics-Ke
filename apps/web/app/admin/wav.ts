/**
 * Minimal WAV writer for the offline-estimate upload.
 *
 * `POST /api/admin/lyrics/:id/sync-estimate` accepts WAV only, but a browser
 * `AudioContext` decodes whatever the platform supports (MP3/M4A/Opus). The
 * adapter therefore decodes once, downsamples to the analysis rate, and writes
 * this header + sample block — pure array maths, no library, no DOM.
 *
 * Shape contract: 16-bit PCM, mono, little-endian, 44-byte canonical header
 * (`RIFF`/`WAVE`/`fmt `/`data`). That is exactly what the API's `decodeWav`
 * expects, and it re-checks every field, so a malformed file is rejected with a
 * readable error rather than estimated wrongly.
 *
 * The sample rate comes from the API's own constant: the decoder resamples a
 * mismatch, but the estimator is calibrated for this rate, so the two must not
 * drift. It lives in `apps/api`, not in a package: this is the one module that
 * both the browser and the server share, and `wav.test.ts` runs it through the
 * real decoder.
 */

// Extension included so the same file resolves under Node's ESM loader in the
// test as well as under the web app's bundler.
import { SYNC_SAMPLE_RATE } from '../../../api/src/library/audio-decode.ts';

/** Sample rate the estimator analyses at. */
export const UPLOAD_SAMPLE_RATE = SYNC_SAMPLE_RATE;

/**
 * Encode mono samples in [-1, 1] as a 16-bit PCM WAV.
 *
 * 16-bit halves the upload against float32 and loses nothing the band-energy
 * analysis cares about. Values outside [-1, 1] are clamped, not wrapped — a
 * wrapped negative peak would read as a loud positive one.
 */
export function encodeWav(samples: Float32Array, sampleRate = UPLOAD_SAMPLE_RATE): ArrayBuffer {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`WAV sample rate must be a positive number (got ${sampleRate}).`);
  }
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    // 32767, not 32768: +1.0 must stay inside the signed range.
    view.setInt16(44 + i * 2, Math.round(clamped * 32_767), true);
  }
  return buffer;
}
