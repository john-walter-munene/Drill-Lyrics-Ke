import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { classifyUpload, parseIsoDuration, type ClassifiedUpload } from './youtube-classify';

interface YouTubeChannelResponse {
  items?: {
    id: string;
    snippet?: { title?: string; description?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

interface YouTubeUploadsResponse {
  nextPageToken?: string;
  /** `totalResults` is the uploads playlist length — the channel's upload count. */
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
  items?: {
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
    snippet?: { title?: string; channelTitle?: string };
  }[];
}

interface YouTubeVideosResponse {
  items?: {
    id: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      categoryId?: string;
      liveBroadcastContent?: string;
    };
    contentDetails?: { duration?: string };
  }[];
}

/** A URL pasted into "add artist" may point at a channel OR at one video. */
export type ChannelReference =
  | { kind: 'channel'; reference: string }
  | { kind: 'video'; videoId: string };

export interface ResolvedYouTubeChannel {
  channelId: string;
  title: string;
  description: string | null;
  uploadsPlaylistId: string;
  sampleVideos: { videoId: string; title: string; publishedAt: string | null }[];
}

/** What one acquisition pass did. Returned to the admin UI verbatim. */
export interface SyncResult {
  /** How many pages of uploads the channel has (known once the walk starts). */
  pages?: number;
  /** Pages read in this pass. */
  pagesThisPass?: number;
  /** Uploads looked at in this pass. */
  scanned: number;
  /** Songs created. */
  created: number;
  /** Songs that already existed and were updated in place. */
  updated: number;
  /** Uploads the classifier ruled out (shorts, live, teasers). */
  skipped: number;
  /**
   * Uploads left out because YouTube reports them as unreleased: a scheduled
   * premiere or an upcoming stream. They are not in the catalogue yet, and a
   * later sync picks them up once they go live.
   */
  awaitingRelease?: number;
  /** How many candidate drafts are on this channel now. */
  drafts: number;
  /** How many are already part of the public catalogue. */
  published: number;
  /** True only when the whole channel has been walked. */
  complete: boolean;
  /**
   * Set when the import stopped early because the channel is not all music.
   *
   * It does NOT stop the walk any more: every upload is still imported — the
   * unclear ones as review candidates — so this reports that the classification
   * filter is in effect for the rest of the channel.
   */
  pausedReason: string | null;
  /** Set when the import published music uploads instead of leaving drafts. */
  autoPublished?: boolean;
  /**
   * Set when YouTube refused part-way through (quota, key, outage). Everything
   * read before the failure is already saved and the next sync resumes from the
   * page that failed, so a long channel is not an all-or-nothing import.
   */
  error?: string;
}

/** Data API playlist page size (the maximum). */
const PAGE_SIZE = 50;

/**
 * Video ids per `videos.list` call.
 *
 * `videos.list` takes a comma-separated id list and still costs **one** unit
 * from a quota of 10,000 a day. Asking for one video at a time, as the first
 * version of this importer did, spent 1 unit per upload: a 500-upload channel
 * cost ~560 of a day's quota, and an admin who tried two channels ran out and
 * the next import failed with a 403. Batching is the difference between "all
 * the songs" and "the quota ran out part-way through".
 */
const VIDEO_BATCH_SIZE = 50;

/**
 * Pages fetched per pass for the periodic worker **when YOUTUBE_WORKER_PAGES is
 * not set**. A sync from the admin UI always walks the WHOLE channel: that is
 * the acquisition promise — one link, the entire catalogue — and it is bounded
 * by YouTube's own pagination rather than by a token budget. Unset therefore
 * means "all pages" for the worker too; a busy deployment can cap the cycle by
 * setting YOUTUBE_WORKER_PAGES.
 */
const WORKER_PAGES_DEFAULT = Number.POSITIVE_INFINITY;

/** YouTube's "Music" category id. */
const MUSIC_CATEGORY_ID = '10';

/** Metadata for one video, from one batched `videos.list` call. */
interface VideoInfo {
  title: string;
  durationSeconds: number | null;
  categoryId: string | null;
  liveBroadcastContent: 'none' | 'live' | 'upcoming' | null;
  topicChannel: boolean;
  /** True when the API returned no row — deleted, private or region-locked. */
  unavailable: boolean;
  publishedAt: string | null;
}

interface ChannelContext {
  id: string;
  slug: string;
  name: string;
  youtubeChannelId: string | null;
}

@Injectable()
export class YoutubeSyncService {
  private readonly log = new Logger('YoutubeSync');

  constructor(private readonly prisma: PrismaService) { }

  /** Is the Data API configured? The admin UI asks this before offering the form. */
  configured(): boolean {
    return Boolean(process.env.YOUTUBE_API_KEY);
  }

  // --- Reference parsing -----------------------------------------------------

  /**
   * Interpret what an admin pasted.
   *
   * Handles every shape YouTube's own "share" / address bar produce, because an
   * acquisition screen that accepts only *canonical* channel URLs rejects the
   * exact link a person copies from the channel page:
   *
   *   @handle, handle, youtube.com/@handle, youtube.com/c/Name,
   *   youtube.com/user/Name, youtube.com/channel/UC…, and
   *   watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /live/ID, /embed/ID.
   *
   * A video link is valid input too: the artist is the video's channel (which
   * is what makes "paste the track that made me take them seriously" work).
   */
  parseChannelReference(input: string): ChannelReference {
    const value = input.trim();
    if (!value) throw new BadRequestException('Paste a YouTube channel or video link');
    const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;

    if (videoIdPattern.test(value)) return { kind: 'video', videoId: value };
    const directId = value.match(/^(UC[A-Za-z0-9_-]{22})$/);
    if (directId) return { kind: 'channel', reference: directId[1] };
    const rawHandle = value.match(/^@?([A-Za-z0-9._-]{3,})$/);
    if (rawHandle && !value.includes('://')) {
      // A bare word is a handle, not a path. Anything with a dot and no scheme
      // is treated as a URL below.
      if (!value.includes('.')) return { kind: 'channel', reference: `@${rawHandle[1]}` };
    }

    let url: URL;
    try { url = new URL(value.includes('://') ? value : `https://${value}`); }
    catch { throw new BadRequestException('Paste a YouTube channel or video link'); }
    const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id && videoIdPattern.test(id)) return { kind: 'video', videoId: id };
      throw new BadRequestException('That youtu.be link has no video in it');
    }
    if (host !== 'youtube.com' && host !== 'music.youtube.com') {
      throw new BadRequestException('Paste a link from youtube.com or youtu.be');
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const queryVideo = url.searchParams.get('v');
    if (queryVideo && videoIdPattern.test(queryVideo)) return { kind: 'video', videoId: queryVideo };

    if (segments.length === 0) throw new BadRequestException('That link is YouTube\'s home page, not a channel');
    if (segments[0].startsWith('@')) return { kind: 'channel', reference: `@${segments[0].slice(1)}` };
    if (segments[0] === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(segments[1] ?? '')) {
      return { kind: 'channel', reference: segments[1] };
    }
    if (segments[0] === 'user' && segments[1]) return { kind: 'channel', reference: `user:${segments[1]}` };
    if (segments[0] === 'c' && segments[1]) return { kind: 'channel', reference: `c:${segments[1]}` };
    if (['shorts', 'live', 'embed', 'v'].includes(segments[0]) && segments[1] && videoIdPattern.test(segments[1])) {
      return { kind: 'video', videoId: segments[1] };
    }
    throw new BadRequestException('That YouTube link is not a channel or a video');
  }

  // --- Resolution ------------------------------------------------------------

  /** The channel a pasted reference points at (following a video to its channel). */
  async resolveChannel(reference: string): Promise<ResolvedYouTubeChannel> {
    const key = this.requireKey();
    const parsed = this.parseChannelReference(reference);

    if (parsed.kind === 'video') {
      const videos = await this.youtubeGet<YouTubeVideosResponse>('videos', {
        part: 'snippet', id: parsed.videoId, key,
      });
      const snippet = videos.items?.[0]?.snippet;
      if (!snippet) throw new BadRequestException('That video is private, deleted, or not available through the API');
      const channelId = (snippet as { channelId?: string }).channelId;
      if (!channelId) throw new BadRequestException('Could not find the channel that owns that video');
      // Via /channel/ID on the first page of uploads: the video we were given is
      // the one the admin actually meant, so it leads the sample list.
      return this.resolveChannelById(channelId, key, parsed.videoId);
    }

    const lookup = this.channelLookupParams(parsed.reference);
    const response = await this.youtubeGet<YouTubeChannelResponse>('channels', {
      part: 'snippet,contentDetails', ...lookup, key,
    });
    const channel = response.items?.[0];
    if (!channel) {
      throw new BadRequestException(
        parsed.reference.startsWith('c:') || parsed.reference.startsWith('user:')
          ? 'YouTube has retired /c/ and /user/ URLs for this channel. Open the channel and paste its @handle or /channel/ URL instead.'
          : 'That YouTube channel could not be found',
      );
    }
    return this.describeChannel(channel, key);
  }

  private async resolveChannelById(channelId: string, key: string, leadVideoId?: string) {
    const response = await this.youtubeGet<YouTubeChannelResponse>('channels', {
      part: 'snippet,contentDetails', id: channelId, key,
    });
    const channel = response.items?.[0];
    if (!channel) throw new BadRequestException('That YouTube channel could not be found');
    const resolved = await this.describeChannel(channel, key);
    if (leadVideoId && !resolved.sampleVideos.some((video) => video.videoId === leadVideoId)) {
      resolved.sampleVideos.unshift({ videoId: leadVideoId, title: 'Linked video', publishedAt: null });
    }
    return resolved;
  }

  private async describeChannel(channel: NonNullable<YouTubeChannelResponse['items']>[number], key: string): Promise<ResolvedYouTubeChannel> {
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    if (!channel.id || !uploadsPlaylistId) throw new BadRequestException('That YouTube channel could not be verified');
    const uploads = await this.youtubeGet<YouTubeUploadsResponse>('playlistItems', {
      part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: '10', key,
    });
    return {
      channelId: channel.id,
      title: channel.snippet?.title?.trim() || 'YouTube channel',
      description: channel.snippet?.description?.trim() || null,
      uploadsPlaylistId,
      sampleVideos: (uploads.items ?? []).flatMap((item) => {
        const videoId = item.contentDetails?.videoId;
        if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return [];
        return [{
          videoId,
          title: item.snippet?.title?.trim() || `YouTube video ${videoId}`,
          publishedAt: item.contentDetails?.videoPublishedAt ?? null,
        }];
      }),
    };
  }

  private channelLookupParams(reference: string): Record<string, string> {
    if (reference.startsWith('@')) return { forHandle: reference.slice(1) };
    if (reference.startsWith('user:')) return { forUsername: reference.slice(5) };
    if (reference.startsWith('c:')) return { forHandle: reference.slice(2) };
    return { id: reference };
  }

  // --- Acquisition -----------------------------------------------------------

  /**
   * Import everything an artist's channel has.
   *
   * One pass, from the first upload to the last: `complete` is true only when
   * the final page was reached. The classification filter decides what becomes
   * a public song, never whether the walk continues. `force` imports uploads
   * that could not be confirmed as music — "import all uploads" in the admin UI
   * — and `restart` begins again at the newest upload instead of resuming at the
   * saved token, for a channel whose earlier walk finished before it imported
   * anything.
   *
   * Progress is saved **after every page**, so a failure on page 30 of 40 keeps
   * the 29 pages already imported and resumes at 30 next time.
   */
  async syncArtistNow(
    artistId: string,
    options: { force?: boolean; pages?: number; restart?: boolean } = {},
  ): Promise<SyncResult> {
    // Per artist, one walk. The cursor, the page token and the per-page totals
    // live on ONE row, so two walkers (a double-clicked "Sync", the embedded
    // worker starting while an admin sync runs) overwrite each other's
    // position — the symptom is an import that never finishes, or one that
    // starts over. A second caller gets a refusal it can show, not a race.
    if (this.inFlight.has(artistId)) {
      throw new ConflictException('This channel is already being imported. Wait for the current import to finish, then try again.');
    }
    this.inFlight.add(artistId);
    try {
      return await this.acquireArtist(artistId, options);
    } finally {
      this.inFlight.delete(artistId);
    }
  }

  /** Artists with a walk in progress in THIS process. */
  private readonly inFlight = new Set<string>();

  private async acquireArtist(
    artistId: string,
    options: { force?: boolean; pages?: number; restart?: boolean },
  ): Promise<SyncResult> {
    const key = this.requireKey('Importing a catalogue');
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { id: true, slug: true, name: true, youtubeChannelId: true },
    });
    if (!artist) throw new BadRequestException('Artist not found');
    if (!artist.youtubeChannelId) throw new BadRequestException('This artist has no YouTube channel');

    const stored = await this.prisma.youtubeChannelSync.upsert({
      where: { artistId },
      create: { artistId },
      update: {},
    });
    // `pausedByFilter` is only a label now — the walk always continues — so a
    // paused channel resumes like any other. It used to make every later sync
    // return "0 scanned" and import nothing, which is exactly the state a
    // channel that was added once and then stopped growing was stuck in.
    const autoPublish = this.autoPublishEnabled();
    let uploadsPlaylistId = stored.uploadsPlaylistId;
    if (!uploadsPlaylistId) {
      const channels = await this.youtubeGet<YouTubeChannelResponse>('channels', {
        part: 'contentDetails', id: artist.youtubeChannelId, key,
      });
      uploadsPlaylistId = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
      if (!uploadsPlaylistId) {
        await this.recordFailure(artistId, 'This channel has no public uploads playlist');
        throw new BadRequestException('This channel has no public uploads playlist');
      }
      await this.prisma.youtubeChannelSync.update({ where: { artistId }, data: { uploadsPlaylistId } });
    }

    // A restart starts with a clean slate: no leftover pause, and no remembered
    // position.
    if (options.restart) {
      await this.prisma.youtubeChannelSync.update({
        where: { artistId },
        data: { pausedByFilter: false, initialImportComplete: false, nextPageToken: null },
      });
    }
    const sync = {
      ...stored,
      pausedByFilter: false,
      ...(options.restart ? { initialImportComplete: false, nextPageToken: null } : {}),
    };

    const totals: SyncResult = {
      scanned: 0, created: 0, updated: 0, skipped: 0, drafts: 0, published: 0,
      complete: false, pausedReason: null, autoPublished: autoPublish,
    };
    let publishedCount = 0;
    let filterNoted = false;

    const maxPages = options.pages ?? Number.POSITIVE_INFINITY;
    let pageToken = sync.initialImportComplete ? undefined : sync.nextPageToken ?? undefined;
    let completed = sync.initialImportComplete;
    let failure: string | null = null;

    // The channel's own upload count, from the FIRST page, before any walk.
    // `pageInfo.totalResults` is the uploads playlist's length and costs nothing
    // extra. It is also the only bound that does not depend on YouTube's
    // `nextPageToken` behaving: a 141-upload channel once "scanned" 12,000
    // uploads because every cycle re-read the same pages.
    const { total: channelTotal } = await this.uploadsTotal(uploadsPlaylistId, pageToken, key);

    try {
      let page = 0;
      do {
        if (channelTotal !== null && totals.scanned >= channelTotal) {
          completed = true;
          pageToken = undefined;
          break;
        }

        const response = await this.youtubeGet<YouTubeUploadsResponse>('playlistItems', {
          part: 'snippet,contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults: String(PAGE_SIZE),
          ...(pageToken ? { pageToken } : {}),
          key,
        });
        page += 1;
        totals.pagesThisPass = page;

        // One page at a time means each upload's classification can use the
        // page's own snippet (title, publish date) and the videos.list batch
        // only fills in what it cannot give: duration and category.
        const items = (response.items ?? []).filter((item) => {
          const videoId = item.contentDetails?.videoId;
          return Boolean(videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId));
        });
        const infos = await this.videoInfoBatch(
          items.map((item) => item.contentDetails!.videoId!),
          key,
          // The playlist entry carries the date the upload was PUBLISHED; the
          // video's own `snippet.publishedAt` is when it was uploaded, which is
          // a different day for a scheduled premiere. The entry wins.
          new Map((response.items ?? []).flatMap((item) => {
            const videoId = item.contentDetails?.videoId;
            const publishedAt = item.contentDetails?.videoPublishedAt;
            return videoId && publishedAt ? [[videoId, publishedAt] as const] : [];
          })),
        );
        // Which video ids are already songs, in ONE query per page. The first
        // version asked per upload, so walking a 5,000-upload channel cost
        // 5,000 round trips before it even reached the writes.
        const known = await this.knownVideoIds(items.map((item) => item.contentDetails!.videoId!));

        for (const item of items) {
          const videoId = item.contentDetails!.videoId!;
          totals.scanned += 1;

          const info = infos.get(videoId);
          // Removed, private or blocked since it was uploaded. Nothing to
          // import, and nothing to say about it beyond the count.
          if (!info || info.unavailable) {
            totals.skipped += 1;
            continue;
          }

          const verdict = classifyUpload({
            title: info.title,
            durationSeconds: info.durationSeconds,
            category: info.categoryId === MUSIC_CATEGORY_ID ? 'Music' : info.categoryId,
            liveBroadcastContent: info.liveBroadcastContent,
            topicChannel: info.topicChannel,
            publishedAt: info.publishedAt,
          });

          // Shapes that are never a release (shorts, live streams, sub-30s
          // clips): no, even when forced. "Import every upload" must not
          // import a live stream.
          if (verdict.kind === 'rejected') {
            totals.skipped += 1;
            // Counted apart from shorts and teasers: "not imported yet" and
            // "never a song" are different answers to "where is the rest of
            // the catalogue?".
            if (verdict.reasons.includes('live stream')) totals.awaitingRelease = (totals.awaitingRelease ?? 0) + 1;
            continue;
          }

          const musical = verdict.kind !== 'unclear';
          if (!musical && !options.force && !filterNoted) {
            // A run of uploads that do not look like music is reported once, and
            // then only this channel's unclear uploads are held as review
            // candidates. The walk itself NEVER stops for it: stopping left the
            // rest of the channel unimported and kept the resume token on the
            // same page, so a second sync re-read it and imported nothing. That
            // is how a real artist ended up with zero videos in the app.
            filterNoted = true;
            totals.pausedReason = this.unclearReason();
            await this.prisma.youtubeChannelSync.update({
              where: { artistId },
              data: { lastError: this.unclearReason() },
            }).catch(() => undefined);
          }

          const outcome = await this.importUpload(artist, {
            videoId,
            title: info.title,
            publishedAt: info.publishedAt,
            durationSeconds: info.durationSeconds,
            known: known.get(videoId),
            publish: autoPublish && musical,
          }, musical ? verdict : {
            ...verdict,
            kind: 'unclear',
            reasons: [...verdict.reasons, 'needs review: not confirmed as music'],
          });
          if (outcome.created) totals.created += 1;
          else totals.updated += 1;
          if (outcome.published) publishedCount += 1;
          if (!musical) totals.skipped += 1;
        }

        // Save the walk's position before anything else can fail, so a quota
        // error on the NEXT page does not throw away this one.
        totals.pages = (totals.pages ?? 0) + 1;
        if (!response.nextPageToken) {
          completed = true;
          pageToken = undefined;
        } else {
          pageToken = response.nextPageToken;
        }
        await this.prisma.youtubeChannelSync.update({
          where: { artistId },
          data: {
            initialImportComplete: completed,
            nextPageToken: completed ? null : pageToken ?? null,
            lastSyncAt: new Date(),
            lastScanned: totals.scanned,
            lastCreated: totals.created,
            pausedByFilter: filterNoted,
          },
        });
      } while (page < maxPages);

      totals.complete = completed;
    } catch (error) {
      // What was read so far is saved; the pause/complete flags are left as the
      // last successfully written page set them. The caller gets both the
      // reason and the partial counts.
      failure = error instanceof Error ? error.message : 'Sync failed';
      await this.recordFailure(artistId, failure);
      // A stopped walk is not a finished one: report the next page as the place
      // to resume, never `complete: true` with a half-read channel.
      totals.complete = false;
    }

    const summary = await this.channelSummary(artistId);
    totals.drafts = summary.drafts;
    totals.published = summary.published;
    totals.pagesThisPass = totals.pages ?? 0;
    totals.pages = totals.pages ?? 1;

    // One request to the web app, not one per song: it drops the cached
    // catalogue pages so the imported songs are on the artist page and /songs
    // the next time anyone loads them.
    if (publishedCount > 0) await this.revalidateCatalogue(artist.slug);
    if (failure) totals.error = failure;
    return totals;
  }

  /**
   * Tell the web app to re-render cached catalogue pages.
   *
   * Next.js caches the artist page, /songs and the home shelves for 2–5 minutes.
   * Without this, a finished import still shows "no songs yet" until an
   * unrelated rebuild. Best effort: the API never fails an import because the
   * web app is down, and `npm run stack:up`/a revalidation path still heal it.
   */
  /** Public entry point for the admin's "Publish song" action. */
  revalidateCatalogueNow(artistSlug?: string): Promise<void> {
    return this.revalidateCatalogue(artistSlug);
  }

  private async revalidateCatalogue(artistSlug?: string): Promise<void> {
    // Inside the compose network NEXT_PUBLIC_SITE_URL is the user's browser
    // origin (localhost:3000), and from the api container "localhost" is the
    // api itself — so the fallback below is used unless WEB_INTERNAL_URL is set.
    // The dev and production compose files set it to http://web:3000.
    const base = (process.env.WEB_INTERNAL_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    if (!base) return;
    const paths = ['/', '/songs', '/artists', ...(artistSlug ? [`/artists/${artistSlug}`] : [])];
    try {
      await fetch(`${base}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paths }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      this.log.debug('Could not revalidate the web catalogue (web app not reachable)');
    }
  }

  /** Imported YouTube songs become public songs unless YOUTUBE_AUTO_PUBLISH=false. */
  autoPublishEnabled(): boolean {
    return process.env.YOUTUBE_AUTO_PUBLISH !== 'false';
  }

  /** Periodic cycle over every sync-enabled artist. Bounded per artist. */
  async runOnce(): Promise<{ scanned: number; created: number }> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      this.log.debug('YOUTUBE_API_KEY unset — skipping import cycle');
      return { scanned: 0, created: 0 };
    }

    await this.refreshExpiredMetadata(key);

    const artists = await this.prisma.artist.findMany({
      where: { youtubeSyncEnabled: true, youtubeChannelId: { not: null }, youtubeSync: { pausedByFilter: false } },
      select: { id: true },
      orderBy: { slug: 'asc' },
    });

    let scanned = 0;
    let created = 0;
    for (const artist of artists) {
      try {
        const pages = Number(process.env.YOUTUBE_WORKER_PAGES);
        const result = await this.syncArtistNow(artist.id, {
          pages: Number.isFinite(pages) && pages > 0 ? pages : WORKER_PAGES_DEFAULT,
        });
        scanned += result.scanned;
        created += result.created;
      } catch (error) {
        this.log.warn(`Could not sync YouTube channel for artist ${artist.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { scanned, created };
  }

  /**
   * Create or update the song row for one upload.
   *
   * Upsert on `youtubeVideoId`: the same video linked from two artists must
   * become ONE song (with a second credit), not a duplicate the second time.
   * That is also what makes a re-run of a 400-video sync safe.
   */
  private async importUpload(
    artist: ChannelContext,
    upload: {
      videoId: string;
      title: string;
      publishedAt: string | null;
      /** Song length, when YouTube reported one. Used for the player's queue. */
      durationSeconds?: number | null;
      /** State read in the page's batched lookup; `undefined` = look it up. */
      known?: { id: string; artistIds: string[] } | null;
      /** Publish straight into the catalogue (music uploads, auto-publish on). */
      publish?: boolean;
    },
    verdict: ClassifiedUpload,
  ): Promise<{ created: boolean; published: boolean }> {
    const existing = upload.known !== undefined
      ? upload.known && { id: upload.known.id, artists: upload.known.artistIds.map((artistId) => ({ artistId })) }
      : await this.prisma.song.findUnique({
        where: { youtubeVideoId: upload.videoId },
        select: { id: true, artists: { select: { artistId: true } } },
      });

    const releaseDate = upload.publishedAt ? new Date(upload.publishedAt) : null;
    const durationMs = upload.durationSeconds && upload.durationSeconds > 0 ? upload.durationSeconds * 1_000 : null;

    if (existing) {
      if (!existing.artists.some((credit) => credit.artistId === artist.id)) {
        await this.prisma.songArtist.create({ data: { songId: existing.id, artistId: artist.id, isPrimary: false, position: existing.artists.length } });
      }
      // A song that came in earlier as a draft (auto-publish off, or an
      // earlier run) is promoted the next time the channel is read, so
      // switching the setting on does not need a manual pass over /admin.
      if (upload.publish) {
        const promoted = await this.prisma.song.updateMany({
          where: { id: existing.id, status: { in: ['draft', 'pending'] } },
          data: { status: 'published', ...(durationMs ? { durationMs } : {}) },
        });
        return { created: false, published: promoted.count > 0 };
      }
      return { created: false, published: false };
    }

    await this.prisma.song.create({
      data: {
        slug: await this.uniqueSlug(upload.title, artist.slug, upload.videoId),
        title: upload.title,
        youtubeVideoId: upload.videoId,
        language: 'mixed',
        releaseDate: releaseDate && Number.isFinite(releaseDate.getTime()) ? releaseDate : null,
        durationMs,
        // Only an upload that must be checked by a human stays a draft.
        status: upload.publish ? 'published' : 'draft',
        youtubeImported: true,
        youtubeMetadataRefreshedAt: new Date(),
        youtubeImportKind: verdict.kind,
        youtubeImportReason: verdict.reasons.join(' · ') || null,
        artists: { create: [{ artistId: artist.id, isPrimary: true, position: 0 }] },
      },
    });
    return { created: true, published: Boolean(upload.publish) };
  }

  /**
   * The channel's upload count, read once before the walk.
   *
   * It is a safety bound on the walk, not a cursor: the walk's position is the
   * `nextPageToken` saved by the previous page. This call used to return a page
   * token too, which was the *resume* token echoed back and therefore undefined
   * on every first pass — so a pass that stopped on page 30 of 40 re-read pages
   * 1…30 on every later sync instead of resuming where it left off.
   */
  private async uploadsTotal(
    playlistId: string,
    resumeToken: string | undefined,
    key: string,
  ): Promise<{ total: number | null }> {
    try {
      const response = await this.youtubeGet<YouTubeUploadsResponse>('playlistItems', {
        part: 'contentDetails',
        playlistId,
        maxResults: '1',
        ...(resumeToken ? { pageToken: resumeToken } : {}),
        key,
      });
      const total = Number(response.pageInfo?.totalResults);
      return { total: Number.isFinite(total) && total > 0 ? total : null };
    } catch {
      // The count is a safety bound, not the import: if it cannot be read, walk
      // the channel the old way rather than refusing to import anything.
      return { total: null };
    }
  }

  /**
   * Which of a page's video ids are already songs, and who they credit.
   *
   * One query for the page instead of one per upload: this is what makes a
   * second walk of a 5,000-upload channel as cheap as the first.
   */
  private async knownVideoIds(videoIds: string[]): Promise<Map<string, { id: string; artistIds: string[] }>> {
    if (!videoIds.length) return new Map();
    const rows = await this.prisma.song.findMany({
      where: { youtubeVideoId: { in: videoIds } },
      select: { id: true, youtubeVideoId: true, artists: { select: { artistId: true } } },
    });
    return new Map(rows.map((row) => [row.youtubeVideoId, {
      id: row.id,
      artistIds: row.artists.map((credit) => credit.artistId),
    }]));
  }

  /**
   * Title, category, duration and live status for a page of uploads.
   *
   * `videos.list` costs one quota unit per call no matter how many ids it
   * carries (up to 50), so one page of a channel's playlist is one call. The
   * whole walk of a 1,000-upload channel is ~42 units — well inside the daily
   * allocation — instead of ~1,000.
   */
  private async videoInfoBatch(
    videoIds: string[],
    key: string,
    publishedAtById: ReadonlyMap<string, string> = new Map(),
  ): Promise<Map<string, VideoInfo>> {
    const info = new Map<string, VideoInfo>();
    for (let start = 0; start < videoIds.length; start += VIDEO_BATCH_SIZE) {
      const batch = videoIds.slice(start, start + VIDEO_BATCH_SIZE);
      const response = await this.youtubeGet<YouTubeVideosResponse>('videos', {
        part: 'snippet,contentDetails', id: batch.join(','), key,
      });
      for (const video of response.items ?? []) {
        const live = video.snippet?.liveBroadcastContent;
        info.set(video.id, {
          title: video.snippet?.title?.trim() || `YouTube video ${video.id}`,
          durationSeconds: parseIsoDuration(video.contentDetails?.duration),
          categoryId: video.snippet?.categoryId ?? null,
          liveBroadcastContent: live === 'live' || live === 'upcoming' ? live : 'none',
          // Topic channels are YouTube's own auto-generated artist channels,
          // which carry releases and nothing else.
          topicChannel: / - topic$/i.test(video.snippet?.channelTitle ?? ''),
          unavailable: false,
          publishedAt: publishedAtById.get(video.id) ?? video.snippet?.publishedAt ?? null,
        });
      }
    }
    for (const videoId of videoIds) {
      if (!info.has(videoId)) {
        info.set(videoId, {
          title: `Unavailable YouTube upload ${videoId}`,
          durationSeconds: null,
          categoryId: null,
          liveBroadcastContent: 'none',
          topicChannel: false,
          unavailable: true,
          publishedAt: null,
        });
      }
    }
    return info;
  }

  /** Counts for one artist's imported catalogue. */
  async channelSummary(artistId: string) {
    const [drafts, published, total] = await Promise.all([
      this.prisma.song.count({ where: { youtubeImported: true, status: { in: ['draft', 'pending'] }, artists: { some: { artistId } } } }),
      this.prisma.song.count({ where: { youtubeImported: true, status: 'published', artists: { some: { artistId } } } }),
      this.prisma.song.count({ where: { youtubeImported: true, artists: { some: { artistId } } } }),
    ]);
    return { drafts, published, total };
  }

  // --- Helpers ---------------------------------------------------------------

  private unclearReason() {
    return `Some uploads on this channel do not look like music (interviews, live sets, teasers). They were imported as drafts under Song imports; the rest of the channel was read normally. Use "Import every upload" to add them too.`;
  }

  private requireKey(action = 'YouTube channel verification') {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      throw new ServiceUnavailableException(
        `${action} needs a YouTube Data API key. Set YOUTUBE_API_KEY in the repo-root .env and re-create the api container (npm run dev:stack:restart).`,
      );
    }
    return key;
  }

  private async recordFailure(artistId: string, message: string) {
    await this.prisma.youtubeChannelSync.update({
      where: { artistId },
      data: { lastSyncAt: new Date(), lastError: message.slice(0, 500) },
    }).catch(() => undefined);
  }

  private async uniqueSlug(title: string, artistSlug: string, videoId: string) {
    const base = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'track';
    const preferred = `${artistSlug}-${base}`;
    const clash = await this.prisma.song.findUnique({ where: { slug: preferred }, select: { id: true } });
    // The video id keeps titles unique ("Intro", "Intro (Live)") and is stable
    // across re-imports, so this suffix never has to be recomputed.
    return clash ? `${preferred}-${videoId.toLowerCase()}` : preferred;
  }

  private async refreshExpiredMetadata(key: string) {
    const cutoff = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
    const staleSongs = await this.prisma.song.findMany({
      where: { youtubeImported: true, youtubeMetadataRefreshedAt: { lt: cutoff } },
      select: { id: true, youtubeVideoId: true, title: true, releaseDate: true },
      orderBy: { youtubeMetadataRefreshedAt: 'asc' },
      take: 500,
    });
    const refreshedAt = new Date();
    const writes: { id: string; title: string; releaseDate: Date | null }[] = [];

    for (let offset = 0; offset < staleSongs.length; offset += VIDEO_BATCH_SIZE) {
      const batch = staleSongs.slice(offset, offset + VIDEO_BATCH_SIZE);
      const videos = await this.youtubeGet<YouTubeVideosResponse>('videos', {
        part: 'snippet', id: batch.map((song) => song.youtubeVideoId).join(','), key,
      });
      const byId = new Map((videos.items ?? []).map((video) => [video.id, video.snippet]));
      for (const song of batch) {
        const snippet = byId.get(song.youtubeVideoId);
        const publishedAt = snippet?.publishedAt ? new Date(snippet.publishedAt) : null;
        const title = snippet?.title
          // Remove API-derived text when a video is no longer available.
          ? snippet.title
          : `Unavailable YouTube upload ${song.youtubeVideoId}`;
        const releaseDate = publishedAt && Number.isFinite(publishedAt.getTime()) ? publishedAt : null;
        // Only a real change is a write. Re-writing an unchanged title holds a
        // row lock for the duration of the whole batch, and that is exactly the
        // request the admin's sync is waiting behind.
        const changed = title !== song.title
          || (releaseDate?.getTime() ?? null) !== (song.releaseDate?.getTime() ?? null);
        if (changed) writes.push({ id: song.id, title, releaseDate });
      }
    }

    // Stamping `youtubeMetadataRefreshedAt` on every stale row, changed or not,
    // is what keeps a second sync from choosing the same 500 rows again.
    await this.prisma.song.updateMany({
      where: { id: { in: staleSongs.map((song) => song.id) } },
      data: { youtubeMetadataRefreshedAt: refreshedAt },
    });
    for (const write of writes) {
      await this.prisma.song.update({ where: { id: write.id }, data: { title: write.title, releaseDate: write.releaseDate } });
    }
  }

  private async youtubeGet<T>(resource: 'channels' | 'playlistItems' | 'videos', params: Record<string, string>) {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url);
    if (!response.ok) {
      // The raw status is not actionable; name the fix for the common ones.
      if (response.status === 403) {
        throw new ServiceUnavailableException('YouTube rejected the API key or its quota is exhausted. Check YOUTUBE_API_KEY and the project quota.');
      }
      if (response.status === 400) {
        throw new BadRequestException('YouTube did not recognise that channel or video.');
      }
      throw new ServiceUnavailableException(`YouTube Data API request failed with ${response.status}`);
    }
    return await response.json() as T;
  }
}
