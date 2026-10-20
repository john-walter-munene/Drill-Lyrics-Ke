import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DjsService {
  constructor(private readonly prisma: PrismaService) { }

  list(_query: { city?: string; page?: string }) {
    // TODO(phase-3): page over DJs, optional city filter.
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  bySlug(_slug: string) {
    // TODO(phase-3): DJ + links + tracks spun.
    throw new NotFoundException('DJ profile not implemented yet');
  }
}
