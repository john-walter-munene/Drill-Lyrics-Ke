
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { rankByRelevance } from './relevance';

export interface SearchQuery {
  q?: string;
  types?: string;
}

const SEARCH_TYPES = ['song', 'artist', 'dj', 'podcast', 'event'] as const;
type SearchType = (typeof SEARCH_TYPES)[number];
const LIMIT_PER_TYPE = 8;

/**
 * Public MVP search over published catalogue and scene records.
 *
 * What matches is still a plain case-insensitive substring (`ILIKE`): no
 * extension, no index rebuild. What changed is the **order** — results are
 * re-ranked by `relevance.ts` so an exact title beats a prefix, a prefix beats
 * a word start, and any title hit beats a hit found only in lyrics or a bio.
 *
 * Ranking runs over at most `LIMIT_PER_TYPE` rows per type, so it costs a sort
 * of eight items and needs no extra query. The database still does the
 * filtering, which keeps the query plan unchanged.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) { }

  async search(query: SearchQuery) {
    const q = (query.q ?? '').trim().slice(0, 100);
    if (q.length < 2) return { query: q, songs: [], artists: [], djs: [], podcasts: [], events: [] };

    const requested = query.types?.split(',').map((value) => value.trim()).filter(Boolean);
    const invalidType = requested?.find((type) => !SEARCH_TYPES.includes(type as SearchType));
    if (invalidType) throw new BadRequestException(`Unknown search type: ${invalidType}`);
    const enabled = new Set<SearchType>(requested?.length ? requested as SearchType[] : SEARCH_TYPES);
    const contains = { contains: q, mode: 'insensitive' as const };
    const empty = <T,>() => Promise.resolve([] as T[]);

    const [songs, artists, djs, podcasts, events] = await Promise.all([
      enabled.has('song') ? this.prisma.song.findMany({
        where: {
          status: 'published',
          OR: [
            { title: contains },
            { artists: { some: { artist: { name: contains } } } },
            { versions: { some: { published: true, lines: { some: { text: contains } } } } },
          ],
        },
        orderBy: [{ releaseDate: 'desc' }, { title: 'asc' }], take: LIMIT_PER_TYPE,
        include: {
          artists: { include: { artist: true }, orderBy: { position: 'asc' } },
          // Only published lines, and only the text: the ranking needs the
          // words, not the timestamps, and a draft version must not influence
          // the order of a public result.
          versions: {
            where: { published: true },
            select: { lines: { select: { text: true } } },
          },
        },
      }) : empty<never>(),
      enabled.has('artist') ? this.prisma.artist.findMany({ where: { OR: [{ name: contains }, { bio: contains }] }, orderBy: { name: 'asc' }, take: LIMIT_PER_TYPE }) : empty<never>(),
      enabled.has('dj') ? this.prisma.dj.findMany({ where: { OR: [{ name: contains }, { bio: contains }, { city: contains }] }, orderBy: { name: 'asc' }, take: LIMIT_PER_TYPE }) : empty<never>(),
      enabled.has('podcast') ? this.prisma.podcast.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { hostName: contains }, { episodes: { some: { title: contains } } }] },
        orderBy: { title: 'asc' }, take: LIMIT_PER_TYPE,
      }) : empty<never>(),
      enabled.has('event') ? this.prisma.event.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { city: contains }, { venue: contains }] },
        orderBy: [{ startsAt: 'asc' }, { title: 'asc' }], take: LIMIT_PER_TYPE,
      }) : empty<never>(),
    ]);

    // Titles first; a song whose *lyrics* mention the query is a weaker match
    // than a song whose title does. Body fields mirror the SQL `OR` above.
    const rankedSongs = rankByRelevance(
      songs.map((song) => ({
        row: song,
        title: song.title,
        body: [
          ...song.artists.map((item) => item.artist.name),
          ...song.versions.flatMap((version) => version.lines.map((line) => line.text)),
        ],
      })),
      q,
    ).map((entry) => entry.row);

    const rankedArtists = rankByRelevance(
      artists.map((artist) => ({ row: artist, title: artist.name, body: [artist.bio] })),
      q,
    ).map((entry) => entry.row);

    const rankedDjs = rankByRelevance(
      djs.map((dj) => ({ row: dj, title: dj.name, body: [dj.bio, dj.city] })),
      q,
    ).map((entry) => entry.row);

    const rankedPodcasts = rankByRelevance(
      podcasts.map((podcast) => ({ row: podcast, title: podcast.title, body: [podcast.description, podcast.hostName] })),
      q,
    ).map((entry) => entry.row);

    const rankedEvents = rankByRelevance(
      events.map((event) => ({ row: event, title: event.title, body: [event.description, event.venue, event.city] })),
      q,
    ).map((entry) => entry.row);

    return {
      query: q,
      songs: rankedSongs.map((song) => ({ slug: song.slug, title: song.title, subtitle: song.artists.map((item) => item.artist.name).join(', ') || null, imageUrl: `https://i.ytimg.com/vi/${song.youtubeVideoId}/hqdefault.jpg` })),
      artists: rankedArtists.map((artist) => ({ slug: artist.slug, title: artist.name, subtitle: 'Artist', imageUrl: artist.imageUrl })),
      djs: rankedDjs.map((dj) => ({ slug: dj.slug, title: dj.name, subtitle: dj.city ?? 'DJ', imageUrl: dj.imageUrl })),
      podcasts: rankedPodcasts.map((podcast) => ({ slug: podcast.slug, title: podcast.title, subtitle: podcast.hostName ? `Podcast · ${podcast.hostName}` : 'Podcast', imageUrl: podcast.imageUrl })),
      events: rankedEvents.map((event) => ({ slug: event.slug, title: event.title, subtitle: `${event.city} · ${event.startsAt.toISOString().slice(0, 10)}`, imageUrl: event.imageUrl })),
    };
  }
}
