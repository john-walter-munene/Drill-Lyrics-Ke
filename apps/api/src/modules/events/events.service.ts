import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) { }

  list(_query: { from?: string; city?: string; page?: string }) {
    // TODO(phase-3): upcoming first (startsAt >= now), optional city filter.
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  bySlug(_slug: string) {
    // TODO(phase-3): event + artist/DJ lineup.
    throw new NotFoundException('Event not implemented yet');
  }
}
