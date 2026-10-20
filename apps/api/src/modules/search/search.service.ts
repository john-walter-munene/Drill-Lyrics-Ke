
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface SearchQuery {
  q?: string;
  types?: string;
}

/**
 * Search. Phase 3 implements Postgres full-text search + trigram matching on
 * names and titles (see docs/architecture.md §8 — no dedicated search service).
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) { }

  search(query: SearchQuery) {
    const q = (query.q ?? '').trim();
    void query;
    return {
      query: q,
      songs: [],
      artists: [],
      djs: [],
      podcasts: [],
      events: [],
    };
  }
}
