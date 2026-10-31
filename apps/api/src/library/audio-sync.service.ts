import { Injectable } from '@nestjs/common';
import { alignLyrics, type SyncResult } from '@drillke/shared';
import { AudioDecodeError, decodeWav } from './audio-decode';

export { AudioDecodeError };

/**
 * Server-side lyric alignment for clients that cannot run it themselves.
 *
 * The estimator itself lives in `@drillke/shared` and is the *same* module the
 * browser worker imports, so a slow phone and the API produce identical
 * suggestions for identical audio. This service only decodes the upload, then
 * hands the PCM to `alignLyrics`.
 */
@Injectable()
export class AudioSyncService {
  estimate(buffer: Buffer, lineTexts: readonly string[]): SyncResult {
    const audio = decodeWav(new Uint8Array(buffer));
    return alignLyrics(audio, lineTexts);
  }
}
