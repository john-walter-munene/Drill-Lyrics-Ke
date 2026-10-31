import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * DJ directory (`docs/product.md` §5.2).
 *
 * A DJ is a catalogue entity, not an account: a directory listing, a profile with
 * links, the published songs they spin, and the events they appear at. No media is
 * hosted — links point at Mixcloud/SoundCloud/YouTube, the same way an artist
 * links to a channel.
 */
@Injectable()
export class DjsService {
  constructor(private readonly prisma: PrismaService) { }

  async list(query: { city?: string; page?: string }) {
    const page = pageNumber(query.page);
    const pageSize = 20;
    const city = query.city?.trim();
    const where = city ? { city: { equals: city, mode: 'insensitive' as const } } : {};

    const [total, djs] = await Promise.all([
      this.prisma.dj.count({ where }),
      this.prisma.dj.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          links: true,
          _count: { select: { tracks: { where: { song: { status: 'published' } } } } },
        },
      }),
    ]);

    return {
      items: djs.map((dj) => ({
        id: dj.id,
        slug: dj.slug,
        name: dj.name,
        bio: dj.bio,
        imageUrl: dj.imageUrl,
        city: dj.city,
        links: dj.links.map(({ label, url }) => ({ label, url })),
        trackCount: dj._count.tracks,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async bySlug(slug: string) {
    const dj = await this.prisma.dj.findUnique({
      where: { slug },
      include: {
        links: true,
        tracks: {
          where: { song: { status: 'published' } },
          orderBy: [{ rank: 'asc' }, { songId: 'asc' }],
          include: {
            song: {
              include: { artists: { include: { artist: true }, orderBy: { position: 'asc' } } },
            },
          },
        },
        events: {
          where: { event: { startsAt: { gte: new Date() } } },
          orderBy: { event: { startsAt: 'asc' } },
          include: { event: { select: { slug: true, title: true, city: true, startsAt: true, venue: true } } },
        },
      },
    });
    if (!dj) throw new NotFoundException('DJ not found');

    return {
      id: dj.id,
      slug: dj.slug,
      name: dj.name,
      bio: dj.bio,
      imageUrl: dj.imageUrl,
      city: dj.city,
      links: dj.links.map(({ label, url }) => ({ label, url })),
      tracks: dj.tracks.map(({ song }) => ({
        slug: song.slug,
        title: song.title,
        artistNames: song.artists.map(({ artist }) => artist.name),
        youtubeVideoId: song.youtubeVideoId,
      })),
      upcomingEvents: dj.events.map(({ event }) => ({
        slug: event.slug,
        title: event.title,
        city: event.city,
        venue: event.venue,
        startsAt: event.startsAt.toISOString(),
      })),
    };
  }
}

/** Clamp a query-string page to a sane positive integer. */
function pageNumber(value?: string): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}
