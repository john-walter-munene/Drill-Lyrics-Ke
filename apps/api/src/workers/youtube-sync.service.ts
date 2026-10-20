import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * YouTube metadata import (Phase 2). Fetches channel/video metadata with the
 * Data API and proposes new `Song` rows for review — it never downloads media.
 *
 * Runs on an interval when embedded in the API (`EMBED_WORKER=true`) or as its
 * own process: `node dist/workers/youtube-sync.worker.js`.
 */
@Injectable()
export class YoutubeSyncService {
  private readonly log = new Logger('YoutubeSync');

  constructor(private readonly prisma: PrismaService) { }

  async runOnce(): Promise<{ scanned: number; created: number }> {
    if (!process.env.YOUTUBE_API_KEY) {
      this.log.debug('YOUTUBE_API_KEY unset — skipping import cycle');
      return { scanned: 0, created: 0 };
    }
    // TODO(phase-2): list verified artists → fetch uploads playlist → dedupe by
    // youtubeVideoId → create draft songs.
    void this.prisma;
    return { scanned: 0, created: 0 };
  }
}
