/**
 * Decode an audio clip into the mono `{ samples, sampleRate }` shape the shared
 * lyric aligner expects.
 *
 * The API accepts **WAV (PCM 8/16/24/32-bit or float)** only — it can be
 * decoded in pure TypeScript with no native dependency, no ffmpeg binary and no
 * GPL codec. Browsers decode MP3/M4A/Opus natively with `AudioContext`, so the
 * client path never needs this module; it exists for clients whose poor
 * hardware cannot run the analysis and which therefore upload the clip.
 *
 * Anything else is rejected with a clear message rather than a garbled result.
 */

export interface DecodedAudio {
  /** Mono PCM in [-1, 1]. */
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}

export class AudioDecodeError extends Error {
  /**
   * Declared as a field, not a constructor parameter property: this module is
   * imported by the browser's WAV writer so that both sides share one sample
   * rate, and that path runs `node --experimental-strip-types`, which cannot
   * strip parameter properties.
   */
  readonly code: 'UNSUPPORTED_FORMAT' | 'UNSUPPORTED_ENCODING' | 'MALFORMED';

  constructor(code: 'UNSUPPORTED_FORMAT' | 'UNSUPPORTED_ENCODING' | 'MALFORMED', message: string) {
    super(message);
    this.name = 'AudioDecodeError';
    this.code = code;
  }
}

/** Target rate for the estimator. Mirrors `DEFAULT_SAMPLE_RATE` in `@drillke/shared`. */
export const SYNC_SAMPLE_RATE = 16_000;
/** Hard cap on decoded audio: 15 minutes of 16 kHz mono float32 ≈ 58 MB, under the 64 MB body limit. */
export const MAX_CLIP_SAMPLES = SYNC_SAMPLE_RATE * 60 * 15;

const RIFF = 0x52494646; // "RIFF"
const WAVE = 0x57415645; // "WAVE"
const FMT = 0x666d7420; // "fmt "
const DATA = 0x64617461; // "data"

/** Decode a WAV file buffer, downmix to mono and resample to {@link SYNC_SAMPLE_RATE}. */
export function decodeWav(buffer: Uint8Array): DecodedAudio {
  if (buffer.byteLength < 44) throw new AudioDecodeError('MALFORMED', 'The audio file is too short to contain a WAV header.');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, false) !== RIFF || view.getUint32(8, false) !== WAVE) {
    throw new AudioDecodeError('UNSUPPORTED_FORMAT', 'Only WAV audio can be sent to the server. Other formats decode in your browser.');
  }

  let format: number | null = null;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (chunkId === FMT) {
      if (chunkSize < 16 || body + 16 > buffer.byteLength) throw new AudioDecodeError('MALFORMED', 'The WAV format chunk is truncated.');
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
    } else if (chunkId === DATA) {
      dataOffset = body;
      // Streaming WAV writers leave 0xFFFFFFFF here; clamp to the real buffer.
      dataLength = Math.min(chunkSize, buffer.byteLength - body);
    }
    // Chunks are word-aligned: pad an odd size up by one byte.
    offset = body + chunkSize + (chunkSize % 2);
  }

  if (format == null) throw new AudioDecodeError('MALFORMED', 'The WAV file has no format chunk.');
  if (!channels || !sampleRate) throw new AudioDecodeError('MALFORMED', 'The WAV file declares no channels or sample rate.');
  if (dataOffset < 0 || dataLength <= 0) throw new AudioDecodeError('MALFORMED', 'The WAV file has no audio data.');
  if (channels > 8) throw new AudioDecodeError('UNSUPPORTED_ENCODING', 'WAV files with more than 8 channels are not supported.');
  if (sampleRate < 6_000 || sampleRate > 192_000) throw new AudioDecodeError('UNSUPPORTED_ENCODING', `Unsupported sample rate ${sampleRate} Hz.`);
  // Format 0xFFFE (WAVE_FORMAT_EXTENSIBLE) is just PCM/a float with a GUID.
  const isPcm = format === 1 || format === 0xfffe;
  const isFloat = format === 3;
  if (!isPcm && !isFloat) throw new AudioDecodeError('UNSUPPORTED_ENCODING', 'Only PCM or float WAV audio is supported.');
  if (isPcm && ![8, 16, 24, 32].includes(bitsPerSample)) throw new AudioDecodeError('UNSUPPORTED_ENCODING', `${bitsPerSample}-bit PCM is not supported.`);
  if (isFloat && bitsPerSample !== 32) throw new AudioDecodeError('UNSUPPORTED_ENCODING', 'Only 32-bit float WAV audio is supported.');

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * channels;
  const frames = Math.floor(dataLength / frameSize);
  if (frames <= 0) throw new AudioDecodeError('MALFORMED', 'The WAV file contains no complete audio frames.');

  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    const base = dataOffset + frame * frameSize;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += readSample(view, base + channel * bytesPerSample, bitsPerSample, isFloat);
    }
    mono[frame] = sum / channels;
  }

  const samples = sampleRate === SYNC_SAMPLE_RATE ? mono : resampleLinear(mono, sampleRate, SYNC_SAMPLE_RATE);
  if (samples.length > MAX_CLIP_SAMPLES) {
    throw new AudioDecodeError('UNSUPPORTED_ENCODING', `Clips longer than ${Math.round(MAX_CLIP_SAMPLES / SYNC_SAMPLE_RATE / 60)} minutes are not accepted.`);
  }
  return { samples, sampleRate: SYNC_SAMPLE_RATE, channels };
}

function readSample(view: DataView, offset: number, bits: number, isFloat: boolean): number {
  if (isFloat) return view.getFloat32(offset, true);
  switch (bits) {
    case 8:
      return (view.getUint8(offset) - 128) / 128;
    case 16:
      return view.getInt16(offset, true) / 32_768;
    case 24: {
      // Little-endian 24-bit signed, sign-extended through bit 31.
      const raw = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
      const signed = raw & 0x80_0000 ? raw - 0x100_0000 : raw;
      return signed / 8_388_608;
    }
    default:
      return view.getInt32(offset, true) / 2_147_483_648;
  }
}

/** Linear interpolation downsampling — enough for the band-energy analysis. */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = input[index] ?? 0;
    const b = input[index + 1] ?? a;
    output[i] = a + (b - a) * fraction;
  }
  return output;
}
