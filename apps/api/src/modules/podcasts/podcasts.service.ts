import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/**
 * Drill podcast index (`docs/product.md` §5.2).
 *
 * Shows and episodes reference external video/audio and never host media. An
 * episode links the artists and songs it discusses, which is what makes a podcast
 * useful next to the player rather than a separate directory.
 */
@Injectable()
export class PodcastsService {
  constructor(private readonly prisma: PrismaService) { }

  async list(query: { page?: string }) {
    const page = pageNumber(query.page);
    const pageSize = 20;

    const [total, shows] = await Promise.all([
      this.prisma.podcast.count(),
      this.prisma.podcast.findMany({
        orderBy: { title: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { episodes: true } },
          episodes: { orderBy: { publishedAt: 'desc' }, take: 1, select: { publishedAt: true } },
        },
      }),
    ]);

    return {
      items: shows.map((show) => ({
        id: show.id,
        slug: show.slug,
        title: show.title,
        description: show.description,
        hostName: show.hostName,
        imageUrl: show.imageUrl,
        episodeCount: show._count.episodes,
        latestEpisodeAt: show.episodes[0]?.publishedAt.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async bySlug(slug: string) {
    const show = await this.prisma.podcast.findUnique({
      where: { slug },
      include: {
        episodes: {
          orderBy: { number: 'desc' },
          include: {
            artists: { include: { artist: { select: { slug: true, name: true } } } },
            songs: { include: { song: { select: { slug: true, title: true } } } },
          },
        },
      },
    });
    if (!show) throw new NotFoundException('Podcast not found');

    return {
      id: show.id,
      slug: show.slug,
      title: show.title,
      description: show.description,
      hostName: show.hostName,
      imageUrl: show.imageUrl,
      episodes: show.episodes.map((episode) => ({
        number: episode.number,
        title: episode.title,
        description: episode.description,
        publishedAt: episode.publishedAt.toISOString(),
        durationMs: episode.durationMs,
        externalUrl: episode.externalUrl,
        platform: episode.platform,
        artists: episode.artists.map(({ artist }) => artist),
        songs: episode.songs.map(({ song }) => song),
      })),
    };
  }

  async episode(slug: string, number: number) {
    if (!Number.isInteger(number) || number < 1) throw new NotFoundException('Episode not found');
    const episode = await this.prisma.podcastEpisode.findFirst({
      where: { number, podcast: { slug } },
      include: {
        podcast: { select: { slug: true, title: true, hostName: true } },
        artists: { include: { artist: { select: { slug: true, name: true } } } },
        songs: { include: { song: { select: { slug: true, title: true, youtubeVideoId: true } } } },
      },
    });
    if (!episode) throw new NotFoundException('Episode not found');

    return {
      podcast: episode.podcast,
      number: episode.number,
      title: episode.title,
      description: episode.description,
      publishedAt: episode.publishedAt.toISOString(),
      durationMs: episode.durationMs,
      externalUrl: episode.externalUrl,
      platform: episode.platform,
      artists: episode.artists.map(({ artist }) => artist),
      songs: episode.songs.map(({ song }) => song),
    };
  }
}

/** Clamp a query-string page to a sane positive integer. */
function pageNumber(value?: string): number {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
}
