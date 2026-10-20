import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface ListArtistsQuery {
  q?: string;
  page?: string;
}

/**
 * Artist reads. Phase 1 implements the queries; the handler signatures and the
 * response shapes (`docs/api.md`) are fixed now so the web app can be written
 * against them.
 */
@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListArtistsQuery) {
    void query;
    // TODO(phase-1): page over published artists filtered by `q` on name.
    return this.emptyPage();
  }

  bySlug(slug: string) {
    void slug;
    // TODO(phase-1): artist + links + published song count, or 404.
    throw new NotFoundException('Artist not implemented yet');
  }

  songs(slug: string, query: { page?: string }) {
    void slug;
    void query;
    // TODO(phase-1): published songs for the artist, newest first.
    return this.emptyPage();
  }

  private emptyPage() {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }
}
