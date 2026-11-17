import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  compileOrderPlan,
  parseCatalogueQuery,
  type OrderPlan,
  type RawCatalogueQuery,
} from '@drillke/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { selectPublishedVersion } from './published-version';

/**
 * The query as it arrives on the wire. Parsing and validation live in
 * `packages/shared/src/catalogue-query.ts`, so the web app and the API cannot
 * disagree about what a sort means or which values are legal.
 */
export type ListSongsQuery = RawCatalogueQuery;

@Injectable()
export class SongsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * The home-page shelves: random, new, recently synchronized, emerging artists.
   *
   * One request, four small queries — a visitor arriving at `/` must not pay
   * for five round trips. Every feed reads published rows only, so nothing here
   * can surface a draft.
   *
   *   - **random** — a handful of songs drawn from the WHOLE catalogue, not the
   *     first page of it. The home page is the shop window, and a fixed "first
   *     six by release date" showed the same records to everyone forever.
   *   - **new** — newest releases; the thing a regular visitor checks for.
   *   - **synced** — songs whose published version carries timings
   *     (`syncedVersionId` is the denormalised pointer kept for exactly this).
   *   - **emerging** — artists with the *fewest* published songs in the
   *     catalogue. Deliberately not "newest artist": a profile created today
   *     with nothing published is not something a fan can act on, so artists
   *     with at least one song come first and the count decides.
   */
  async feeds() {
    const [randomSongs, newSongs, syncedSongs, emerging] = await Promise.all([
      this.randomSongs(6),
      this.prisma.song.findMany({
        where: { status: 'published' },
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        include: this.feedInclude(),
      }),
      this.prisma.song.findMany({
        where: { status: 'published', syncedVersionId: { not: null } },
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        take: 6,
        include: this.feedInclude(),
      }),
      this.prisma.artist.findMany({
        where: { songs: { some: { song: { status: 'published' } } } },
        orderBy: [{ songs: { _count: 'asc' } }, { name: 'asc' }],
        take: 6,
        select: {
          slug: true,
          name: true,
          imageUrl: true,
          _count: { select: { songs: { where: { song: { status: 'published' } } } } },
        },
      }),
    ]);

    return {
      randomSongs: randomSongs.map((song) => this.toSong(song)),
      newSongs: newSongs.map((song) => this.toSong(song)),
      syncedSongs: syncedSongs.map((song) => this.toSong(song)),
      emergingArtists: emerging.map((artist) => ({
        slug: artist.slug,
        name: artist.name,
        imageUrl: artist.imageUrl,
        publishedSongs: artist._count.songs,
      })),
    };
  }

  /**
   * `count` published songs picked at random from the whole catalogue.
   *
   * A random `offset` needs no `ORDER BY random()` (which sorts the entire
   * table) and no extra index: pick a page, read it, wrap around the end so a
   * short final page still fills the shelf.
   */
  private async randomSongs(count: number) {
    const total = await this.prisma.song.count({ where: { status: 'published' } });
    if (total === 0) return [];
    const take = Math.min(count, total);
    const skip = Math.floor(Math.random() * Math.max(1, total - take + 1));
    const songs = await this.prisma.song.findMany({
      where: { status: 'published' },
      orderBy: { id: 'asc' },
      skip,
      take,
      include: this.feedInclude(),
    });
    if (songs.length >= take) return songs;
    const missing = take - songs.length;
    const wrapped = await this.prisma.song.findMany({
      where: { status: 'published' },
      orderBy: { id: 'asc' },
      take: missing,
      include: this.feedInclude(),
    });
    return [...songs, ...wrapped];
  }

  /** The same shape the catalogue returns, so a card renders identically. */
  private feedInclude() {
    return {
      artists: { include: { artist: true }, orderBy: { position: 'asc' as const } },
      versions: { where: { published: true }, orderBy: { version: 'desc' as const }, take: 1 },
    };
  }

  /**
   * The published catalogue, 20 a page.
   *
   * Filtering and ordering are described once in `parseCatalogueQuery` and
   * `compileOrderPlan` (shared, unit-tested) and simply carried out here. A
   * channel import can hold 150 uploads, so "show me only the songs I can read
   * along to" and "what was timed most recently?" have to be answerable in a
   * URL, not only by scrolling page 1 forever.
   *
   * An unknown `sort`/`sync`/`language` is a 400 rather than a silent
   * fallback: a page that ignores `sort=title` looks like an answer and is not.
   */
  async list(query: ListSongsQuery) {
    const parsed = parseCatalogueQuery(query);
    if (!parsed.ok) {
      throw new BadRequestException({
        message: parsed.errors.map((error) => error.message),
        errors: parsed.errors,
      });
    }
    const { q, artist, language, sort, page } = parsed.query;
    const plan = compileOrderPlan(parsed.query);
    const pageSize = 20;
    const where = {
      status: 'published' as const,
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
      ...(artist ? { artists: { some: { artist: { slug: artist } } } } : {}),
      ...(language ? { language } : {}),
      ...(plan.sync === 'synced' ? { syncedVersionId: { not: null } } : {}),
      ...(plan.sync === 'unsynced' ? { syncedVersionId: null } : {}),
    };
    const [total, songs] = await Promise.all([
      this.prisma.song.count({ where }),
      sort === 'artist'
        ? this.artistOrderedPage(where, page, pageSize)
        : this.prisma.song.findMany({
          where,
          orderBy: this.orderFor(plan),
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: this.listInclude(),
        }),
    ]);
    return {
      items: songs.map((song) => this.toSong(song)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private listInclude() {
    return {
      artists: { include: { artist: true }, orderBy: { position: 'asc' as const } },
      versions: { where: { published: true }, orderBy: { version: 'desc' as const }, take: 1 },
    };
  }

  /**
   * Prisma wants literal order objects, so the plan's keys are switched over
   * rather than spread from a computed property name. Every branch ends on
   * `id`, which is what keeps paging stable (see `compileOrderPlan`).
   */
  private orderFor(plan: OrderPlan): Prisma.SongOrderByWithRelationInput[] {
    if (plan.keys[0] === 'syncedAt') {
      return [{ syncedAt: 'desc' }, { id: 'asc' }];
    }
    if (plan.keys[0] === 'title') {
      return [{ title: 'asc' }, { id: 'asc' }];
    }
    return [{ releaseDate: 'desc' }, { id: 'asc' }];
  }

  /**
   * "By artist", correctly.
   *
   * Prisma cannot order a parent by a related field's *value*, and ordering by
   * `artists._count` is not that: it counts credits, so two songs by Wakadinali
   * and one by Natty interleave by title rather than by artist. The first
   * version of this did exactly that, which is why the page is ordered here.
   *
   * So: read the keys, sort in memory, then fetch only the rows on this page.
   * The key query selects four narrow columns, so even a catalogue of a few
   * thousand songs is a small payload. Songs with no credited artist sort last
   * — a listener looking up an artist should never land on an unattributed row
   * — and every tie breaks on `id`, so paging stays stable.
   */
  private async artistOrderedPage(
    where: Prisma.SongWhereInput,
    page: number,
    pageSize: number,
  ) {
    const keys = await this.prisma.song.findMany({
      where,
      select: { id: true, title: true, artists: { select: { artist: { select: { name: true } } } } },
    });
    const primaryName = (row: (typeof keys)[number]) =>
      row.artists.map(({ artist }) => artist.name).sort((a, b) => a.localeCompare(b))[0] ?? null;
    keys.sort((a, b) => {
      const nameA = primaryName(a);
      const nameB = primaryName(b);
      if (nameA !== nameB) {
        if (nameA == null) return 1;
        if (nameB == null) return -1;
        return nameA.localeCompare(nameB);
      }
      const byTitle = a.title.localeCompare(b.title);
      return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id);
    });
    const ids = keys.slice((page - 1) * pageSize, page * pageSize).map((row) => row.id);
    const songs = await this.prisma.song.findMany({ where: { id: { in: ids } }, include: this.listInclude() });
    // `in` does not preserve order; restore the sorted one.
    const byId = new Map(songs.map((song) => [song.id, song]));
    return ids.map((id) => byId.get(id)).filter((song): song is NonNullable<typeof song> => Boolean(song));
  }

  async bySlug(slug: string) {
    const song = await this.prisma.song.findFirst({
      where: { slug, status: 'published' },
      include: {
        artists: { include: { artist: true }, orderBy: { position: 'asc' } },
        versions: { where: { published: true }, orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!song) throw new NotFoundException('Song not found');
    return this.toSong(song);
  }

  /**
   * The published lyrics for a song.
   *
   * Publishes **the** version `Song.syncedVersionId` points at, not simply the
   * newest `published` row. Those are the same version on most songs, but not on
   * one whose latest lyrics were unpublished: `unpublishLyrics` flips
   * `published: false` on that single version, so the next-newest published row
   * is an older, *superseded* version — and serving it silently replaced the
   * lyrics a reader saw with the edition the moderator had just taken down.
   */
  async lyrics(slug: string) {
    const song = await this.prisma.song.findFirst({
      where: { slug, status: 'published' },
      select: {
        syncedVersionId: true,
        versions: {
          where: { published: true },
          orderBy: { version: 'desc' },
          include: { lines: { orderBy: { index: 'asc' } }, annotations: true },
        },
      },
    });
    const version = selectPublishedVersion(song?.versions ?? [], song?.syncedVersionId ?? null);
    if (!version) throw new NotFoundException('Published lyrics not found');
    return {
      versionId: version.id,
      syncStatus: version.syncStatus,
      lines: version.lines.map(({ index, startMs, text }) => ({ index, startMs, text })),
      annotations: version.annotations.map(({ phrase, explanation, lineIndex }) => ({
        phrase, explanation, ...(lineIndex == null ? {} : { lineIndex }),
      })),
    };
  }

  private toSong(song: {
    id: string;
    slug: string;
    title: string;
    youtubeVideoId: string;
    language: string;
    releaseDate: Date | null;
    durationMs: number | null;
    status: string;
    syncedAt: Date | null;
    artists: { isPrimary: boolean; position: number; artist: { slug: string; name: string } }[];
    versions: { id: string; syncStatus: string }[];
  }) {
    const artists = [...song.artists].sort((a, b) => a.position - b.position);
    const primaryArtists = artists.filter((item) => item.isPrimary).map(({ artist }) => artist);
    const featuredArtists = artists.filter((item) => !item.isPrimary).map(({ artist }) => artist);
    const publishedVersion = song.versions[0];
    return {
      id: song.id,
      slug: song.slug,
      title: song.title,
      artists: primaryArtists,
      featuring: featuredArtists,
      artistNames: [...primaryArtists, ...featuredArtists].map((artist) => artist.name),
      youtubeVideoId: song.youtubeVideoId,
      language: song.language,
      releaseDate: song.releaseDate?.toISOString().slice(0, 10) ?? null,
      durationMs: song.durationMs,
      status: song.status,
      syncedAt: song.syncedAt?.toISOString() ?? null,
      lyrics: {
        syncStatus: publishedVersion?.syncStatus ?? 'unsynchronized',
        versionId: publishedVersion?.id ?? null,
      },
    };
  }
}
