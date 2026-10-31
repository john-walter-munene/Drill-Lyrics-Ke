import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * Drill events calendar (`docs/product.md` §5.2).
 *
 * Events are informational: the ticket link goes to the organiser and DrillKe
 * never takes payment in v1. The calendar lists upcoming events first; a `from`
 * date is accepted so the web app can request a window without the API guessing.
 */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) { }

  async list(query: { from?: string; city?: string; page?: string }) {
    const page = pageNumber(query.page);
    const pageSize = 20;
    const from = parseDate(query.from) ?? new Date();
    const city = query.city?.trim();

    const where = {
      startsAt: { gte: from },
      ...(city ? { city: { equals: city, mode: 'insensitive' as const } } : {}),
    };

    const [total, events] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { artists: true, djs: true } },
        },
      }),
    ]);

    return {
      items: events.map((event) => ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        venue: event.venue,
        city: event.city,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        ticketUrl: event.ticketUrl,
        ticketPrice: event.ticketPrice,
        imageUrl: event.imageUrl,
        artistCount: event._count.artists,
        djCount: event._count.djs,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async bySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        artists: { include: { artist: { select: { slug: true, name: true, verified: true } } } },
        djs: { include: { dj: { select: { slug: true, name: true } } } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      venue: event.venue,
      city: event.city,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      ticketUrl: event.ticketUrl,
      ticketPrice: event.ticketPrice,
      imageUrl: event.imageUrl,
      lineup: {
        artists: event.artists.map(({ artist }) => artist),
        djs: event.djs.map(({ dj }) => dj),
      },
    };
  }
}

/** Clamp a query-string page to a sane positive integer. */
function pageNumber(value?: string): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

/**
 * Parse a `from` filter, falling back to `undefined` rather than throwing.
 *
 * A hand-edited or stale query string should show the default calendar, not a
 * 500 — the same reasoning as the page clamp above.
 */
function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
