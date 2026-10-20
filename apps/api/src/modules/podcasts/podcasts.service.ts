import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PodcastsService {
  constructor(private readonly prisma: PrismaService) { }

  list(_query: { page?: string }) {
    // TODO(phase-3): page over shows with episode counts.
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  bySlug(_slug: string) {
    // TODO(phase-3): show + episodes, newest first.
    throw new NotFoundException('Podcast not implemented yet');
  }

  episode(_slug: string, _number: number) {
    // TODO(phase-3): episode + linked songs and artists.
    throw new NotFoundException('Episode not implemented yet');
  }
}
