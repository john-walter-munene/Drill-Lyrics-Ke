import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { selectPublishedVersion } from './published-version';

export interface ListSongsQuery {
  q?: string;
  artist?: string;
  page?: string;
}

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

  async list(query: ListSongsQuery) {
    const page = this.pageNumber(query.page);
    const pageSize = 20;
    const where = {
      status: 'published' as const,
      ...(query.q?.trim() ? { title: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}),
      ...(query.artist ? { artists: { some: { artist: { slug: query.artist } } } } : {}),
    };
    const [total, songs] = await Promise.all([
      this.prisma.song.count({ where }),
      this.prisma.song.findMany({
        where,
        orderBy: [{ releaseDate: 'desc' }, { title: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          artists: { include: { artist: true }, orderBy: { position: 'asc' } },
          versions: { where: { published: true }, orderBy: { version: 'desc' }, take: 1 },
        },
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
      lyrics: {
        syncStatus: publishedVersion?.syncStatus ?? 'unsynchronized',
        versionId: publishedVersion?.id ?? null,
      },
    };
  }

  private pageNumber(value?: string) {
    const page = Number(value ?? 1);
    return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
  }
}
