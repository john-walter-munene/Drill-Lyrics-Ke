import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface ListSongsQuery {
  q?: string;
  artist?: string;
  page?: string;
}

/**
 * Song reads. `lyrics()` is the hot path: it returns the *published* version's
 * lines and annotations in one payload (docs/lyrics-format.md §3).
 */
@Injectable()
export class SongsService {
  constructor(private readonly prisma: PrismaService) { }

  list(query: ListSongsQuery) {
    void query;
    // TODO(phase-1): page over published songs, optional artist filter.
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  bySlug(slug: string) {
    void slug;
    // TODO(phase-1): song + artists + featuring + lyrics sync summary.
    throw new NotFoundException('Song not implemented yet');
  }

  lyrics(slug: string) {
    void slug;
    // TODO(phase-1): load the published LyricVersion with lines + annotations,
    // ordered by index. 404 when no published version exists, so the player can
    // render its "lyrics coming soon" state.
    throw new NotFoundException('Lyrics not implemented yet');
  }
}
