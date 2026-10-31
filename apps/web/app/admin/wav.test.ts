import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeWav } from '../../../api/src/library/audio-decode.ts';
import { encodeWav, UPLOAD_SAMPLE_RATE } from './wav.ts';

/**
 * The upload path only works if the browser writes what the API reads, so the
 * test runs the writer's output through the API's own decoder rather than
 * checking header bytes in isolation.
 */

test('encodeWav writes a canonical 16-bit mono PCM file', () => {
  const samples = new Float32Array(800);
  const wav = encodeWav(samples);
  const view = new DataView(wav);

  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

  assert.equal(ascii(0, 4), 'RIFF');
  assert.equal(ascii(8, 4), 'WAVE');
  assert.equal(ascii(12, 4), 'fmt ');
  assert.equal(ascii(36, 4), 'data');
  assert.equal(view.getUint32(4, true), wav.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1, 'PCM format tag');
  assert.equal(view.getUint16(22, true), 1, 'mono');
  assert.equal(view.getUint32(24, true), UPLOAD_SAMPLE_RATE);
  assert.equal(view.getUint32(28, true), UPLOAD_SAMPLE_RATE * 2, 'byte rate');
  assert.equal(view.getUint16(34, true), 16, 'bits per sample');
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(wav.byteLength, 44 + samples.length * 2);
});

test('the API decoder accepts what the browser encodes', () => {
  const samples = new Float32Array(3_200);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.sin((i / UPLOAD_SAMPLE_RATE) * 2 * Math.PI * 440) * 0.5;
  }

  const decoded = decodeWav(new Uint8Array(encodeWav(samples)));
  assert.equal(decoded.sampleRate, UPLOAD_SAMPLE_RATE);
  assert.equal(decoded.channels, 1);
  assert.equal(decoded.samples.length, samples.length);

  // 16-bit quantisation: within one LSB (1/32767) of the input sample.
  for (let i = 0; i < samples.length; i += 1) {
    assert.ok(Math.abs(decoded.samples[i] - samples[i]) <= 1 / 32_767 + 1e-7, `sample ${i}`);
  }
});

test('out-of-range samples are clamped, not wrapped', () => {
  // A wrapped -2.0 would decode as a loud positive peak and fake an onset.
  const decoded = decodeWav(new Uint8Array(encodeWav(new Float32Array([2, -2, 0]))));
  // Full scale is ±32767/32768: the writer scales by 32767 so +1.0 cannot
  // overflow int16, which leaves one LSB of headroom at both ends.
  assert.equal(decoded.samples[0], 32_767 / 32_768);
  assert.equal(decoded.samples[1], -32_767 / 32_768);
  assert.equal(decoded.samples[2], 0);
  // The point of the test: the sign never flips under clamp.
  assert.ok(decoded.samples[1] < 0);
});

test('encodeWav rejects a nonsense sample rate', () => {
  assert.throws(() => encodeWav(new Float32Array(10), 0), /sample rate/i);
  assert.throws(() => encodeWav(new Float32Array(10), Number.NaN), /sample rate/i);
});
