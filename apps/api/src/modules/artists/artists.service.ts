import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { YoutubeSyncService, type SyncResult } from '../../workers/youtube-sync.service';

export interface ListArtistsQuery {
  q?: string;
  page?: string;
}

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService, private readonly youtube: YoutubeSyncService) { }

  async submitChannelSuggestion(input: { youtubeChannel: string; suggestedName?: string }, submitterId?: string) {
    const channel = await this.youtube.resolveChannel(input.youtubeChannel);
    if (!channel.sampleVideos.length) throw new BadRequestException('That channel has no public uploads to review');
    const existingArtist = await this.prisma.artist.findUnique({ where: { youtubeChannelId: channel.channelId }, select: { id: true, slug: true } });
    if (existingArtist) throw new ConflictException('That YouTube channel is already in the artist catalogue');
    const existing = await this.prisma.artistSuggestion.findUnique({ where: { youtubeChannelId: channel.channelId } });
    if (existing?.status === 'pending') return { id: existing.id, status: existing.status, alreadySubmitted: true };
    const suggestion = await this.prisma.artistSuggestion.upsert({
      where: { youtubeChannelId: channel.channelId },
      create: {
        youtubeChannelId: channel.channelId,
        channelTitle: channel.title,
        channelDescription: channel.description,
        suggestedName: input.suggestedName?.trim() || null,
        sampleVideos: channel.sampleVideos,
        submitterId: submitterId ?? null,
      },
      update: {
        channelTitle: channel.title,
        channelDescription: channel.description,
        suggestedName: input.suggestedName?.trim() || null,
        sampleVideos: channel.sampleVideos,
        submitterId: submitterId ?? null,
        status: 'pending',
        reviewerId: null,
        reviewNote: null,
        reviewedAt: null,
      },
      select: { id: true, status: true },
    });
    return { ...suggestion, channelTitle: channel.title, sampleVideoCount: channel.sampleVideos.length };
  }

  /**
   * Register an artist from a YouTube link and import their whole channel.
   *
   * The link may be a channel (@handle, /channel/, /c/, /user/) or a single
   * video — a video resolves to the channel that owns it, which is the link
   * most people actually have to hand.
   */
  async createFromChannel(input: { youtubeChannel: string; name?: string; importAll?: boolean }) {
    const channel = await this.youtube.resolveChannel(input.youtubeChannel);
    const existing = await this.prisma.artist.findUnique({ where: { youtubeChannelId: channel.channelId }, select: { id: true, slug: true, name: true } });
    if (existing) {
      // Not an error: the useful answer is "already known, here is its state".
      // Throwing here left the admin with a conflict and no way forward, which
      // is how a second attempt looks broken.
      return {
        artist: existing,
        channel: { title: channel.title, channelId: channel.channelId },
        sync: null as SyncResult | null,
        alreadyExists: true,
        summary: await this.youtube.channelSummary(existing.id),
      };
    }
    const name = input.name?.trim() || channel.title;
    if (name.length < 2 || name.length > 100) throw new BadRequestException('Artist name must be between 2 and 100 characters');
    const artist = await this.createChannelArtist(channel, name);
    // The whole channel, in one pass: adding an artist is a request to bring in
    // everything they have. `force` is only the "import every upload" override
    // for a channel whose uploads do not look like music.
    const sync = await this.youtube.syncArtistNow(artist.id, { force: input.importAll });
    return { artist, channel: { title: channel.title, channelId: channel.channelId }, sync, alreadyExists: false };
  }

  async approveSuggestion(id: string, reviewerId: string) {
    const suggestion = await this.prisma.artistSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('Artist suggestion not found');
    if (suggestion.status !== 'pending') throw new ConflictException('This artist suggestion has already been reviewed');
    const channel = await this.youtube.resolveChannel(`https://www.youtube.com/channel/${suggestion.youtubeChannelId}`);
    const name = suggestion.suggestedName?.trim() || channel.title;
    const artist = await this.prisma.$transaction(async (tx) => {
      const created = await tx.artist.create({
        data: {
          slug: await this.uniqueSlug(tx, name, channel.channelId),
          name,
          youtubeChannelId: channel.channelId,
          youtubeSyncEnabled: true,
          youtubeSync: { create: { uploadsPlaylistId: channel.uploadsPlaylistId } },
        },
        select: { id: true, slug: true, name: true, youtubeChannelId: true },
      });
      await tx.artistSuggestion.update({ where: { id }, data: { status: 'approved', reviewerId, reviewedAt: new Date() } });
      return created;
    });
    // Approval is the same acquisition promise as the add-artist form: the whole
    // channel, not whatever the next worker pass happens to reach.
    const sync = await this.youtube.syncArtistNow(artist.id);
    return { artist, sync };
  }

  async rejectSuggestion(id: string, reviewerId: string, reviewNote?: string) {
    const suggestion = await this.prisma.artistSuggestion.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!suggestion) throw new NotFoundException('Artist suggestion not found');
    if (suggestion.status !== 'pending') throw new ConflictException('This artist suggestion has already been reviewed');
    return this.prisma.artistSuggestion.update({
      where: { id },
      data: { status: 'rejected', reviewerId, reviewNote: reviewNote?.trim() || null, reviewedAt: new Date() },
      select: { id: true, status: true },
    });
  }

  private async createChannelArtist(channel: Awaited<ReturnType<YoutubeSyncService['resolveChannel']>>, name: string) {
    return this.prisma.artist.create({
      data: {
        slug: await this.uniqueSlug(this.prisma, name, channel.channelId),
        name,
        youtubeChannelId: channel.channelId,
        youtubeSyncEnabled: true,
        youtubeSync: { create: { uploadsPlaylistId: channel.uploadsPlaylistId } },
      },
      select: { id: true, slug: true, name: true, youtubeChannelId: true },
    });
  }

  private async uniqueSlug(client: Pick<PrismaService, 'artist'>, name: string, channelId: string) {
    const base = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75) || 'artist';
    const suffix = channelId.slice(-6).toLowerCase();
    const preferred = `${base}-${suffix}`;
    const conflict = await client.artist.findUnique({ where: { slug: preferred }, select: { id: true } });
    return conflict ? `${base}-${channelId.toLowerCase()}` : preferred;
  }

  async list(query: ListArtistsQuery) {
    const page = this.pageNumber(query.page);
    const pageSize = 20;
    // The directory lists artists that have a YouTube channel too. Requiring a
    // published song hid every artist in the seconds between "added" and "first
    // song imported" — and for good on a channel whose import had not run yet.
    const where = {
      ...(query.q?.trim() ? { name: { contains: query.q.trim(), mode: 'insensitive' as const } } : {}),
      OR: [
        { songs: { some: { song: { status: 'published' as const } } } },
        { youtubeChannelId: { not: null } },
      ],
    };
    const [total, artists] = await Promise.all([
      this.prisma.artist.count({ where }),
      this.prisma.artist.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          links: true,
          _count: { select: { songs: { where: { song: { status: 'published' } } } } },
        },
      }),
    ]);
    return {
      items: artists.map((artist) => ({
        id: artist.id,
        slug: artist.slug,
        name: artist.name,
        bio: artist.bio,
        imageUrl: artist.imageUrl,
        youtubeChannelId: artist.youtubeChannelId,
        verified: artist.verified,
        links: artist.links.map(({ label, url }) => ({ label, url })),
        songCount: artist._count.songs,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async bySlug(slug: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { slug },
      include: {
        links: true,
        _count: { select: { songs: { where: { song: { status: 'published' } } } } },
      },
    });
    // A channel-backed artist has a page the moment it is added, even before
    // the import has produced its first song: the page then says so.
    if (!artist || (artist._count.songs === 0 && !artist.youtubeChannelId)) throw new NotFoundException('Artist not found');
    return {
      id: artist.id,
      slug: artist.slug,
      name: artist.name,
      bio: artist.bio,
      imageUrl: artist.imageUrl,
      youtubeChannelId: artist.youtubeChannelId,
      verified: artist.verified,
      links: artist.links.map(({ label, url }) => ({ label, url })),
      songCount: artist._count.songs,
    };
  }

  async songs(slug: string, query: { page?: string }) {
    const page = this.pageNumber(query.page);
    const pageSize = 20;
    const where = { status: 'published' as const, artists: { some: { artist: { slug } } } };
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
      items: songs.map((song) => ({
        id: song.id,
        slug: song.slug,
        title: song.title,
        artists: song.artists.filter((item) => item.isPrimary).map(({ artist }) => artist),
        featuring: song.artists.filter((item) => !item.isPrimary).map(({ artist }) => artist),
        artistNames: song.artists.map(({ artist }) => artist.name),
        youtubeVideoId: song.youtubeVideoId,
        language: song.language,
        releaseDate: song.releaseDate?.toISOString().slice(0, 10) ?? null,
        durationMs: song.durationMs,
        status: song.status,
        lyrics: {
          syncStatus: song.versions[0]?.syncStatus ?? 'unsynchronized',
          versionId: song.versions[0]?.id ?? null,
        },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private pageNumber(value?: string) {
    const page = Number(value ?? 1);
    return Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1;
  }
}
