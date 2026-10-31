import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Role } from '@drillke/shared';
import { PrismaService } from '../../prisma.service';
import { parseLyricsText, resolveAnnotations } from '@drillke/shared';
import type { Annotation } from '@drillke/shared';
import { ArtistsService } from '../artists/artists.service';
import { YoutubeSyncService } from '../../workers/youtube-sync.service';
import { MailService } from '../mail/mail.service';
import { siteUrl as siteUrlFromEnv } from '../auth/session-cookie';

/** Every value `LyricsSubmission.status` can hold (mirrors the Prisma enum). */
const SUBMISSION_STATUSES = [
  'draft',
  'pending',
  'changes_requested',
  'approved',
  'published',
  'rejected',
  'unpublished',
] as const;

type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Moderation and review. Every mutating action here must:
 *   1. write an `AuditLog` row, and
 *   2. bump `Song.syncedVersionId` when a synchronized version is published.
 *
 * Review outcomes also notify the contributor when the submission is tied to an
 * account (`MailService`). A notification is never allowed to fail the review:
 * the action has already committed by the time it is sent.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artists: ArtistsService,
    private readonly youtube: YoutubeSyncService,
    private readonly mail: MailService,
  ) { }

  async overview() {
    const [artists, songs, pendingLyrics, pendingArtists, draftSongs, members] = await Promise.all([
      this.prisma.artist.count(), this.prisma.song.count({ where: { status: 'published' } }),
      this.prisma.lyricsSubmission.count({ where: { status: 'pending' } }), this.prisma.artistSuggestion.count({ where: { status: 'pending' } }),
      this.prisma.song.count({ where: { status: 'draft' } }), this.prisma.user.count(),
    ]);
    return { artists, publishedSongs: songs, pendingLyrics, pendingArtistSuggestions: pendingArtists, draftSongs, members };
  }

  async lyricsQueue(status = 'pending') {
    // Unknown values fall back to `pending` rather than reaching Prisma as an
    // invalid enum and raising a 500 on a hand-edited query string.
    const allowed = SUBMISSION_STATUSES;
    const state: SubmissionStatus = (allowed as readonly string[]).includes(status)
      ? status as SubmissionStatus
      : 'pending';
    const items = await this.prisma.lyricsSubmission.findMany({ where: { status: state }, orderBy: { createdAt: 'asc' }, take: 100,
      include: { song: { select: { id: true, title: true, slug: true, youtubeVideoId: true, artists: { include: { artist: { select: { name: true } } } } } }, user: { select: { id: true, displayName: true } }, publishedVersion: { select: { annotations: true } } } });
    return { items, total: items.length, page: 1, pageSize: 100, totalPages: 1 };
  }

  /**
   * Ordered lyric text for the shared aligner. Works for pending submissions
   * and for published-version corrections; the text is always re-parsed here,
   * never taken from the client.
   */
  async getSubmissionLines(id: string): Promise<string[]> {
    const submission = await this.prisma.lyricsSubmission.findUnique({ where: { id }, select: { markdown: true } });
    if (!submission) throw new NotFoundException('Lyrics submission not found');
    const parsed = parseLyricsText(submission.markdown);
    if (!parsed.ok) throw new ConflictException({ message: 'The submitted lyric text is invalid', errors: parsed.errors });
    return parsed.lyrics.lines.map((line) => line.text);
  }

  async approveLyrics(id: string, actorId: string, annotations?: Annotation[]) {
    const submission = await this.prisma.lyricsSubmission.findUnique({
      where: { id },
      include: { song: { include: { artists: { include: { artist: { select: { name: true } } } } } }, user: { select: { email: true } } },
    });
    if (!submission) throw new NotFoundException('Lyrics submission not found');
    if (!['pending', 'changes_requested', 'approved'].includes(submission.status)) throw new ConflictException('This submission cannot be approved in its current state');
    const parsed = parseLyricsText(submission.markdown);
    if (!parsed.ok) throw new ConflictException('The submitted lyric text is invalid; request changes before approval');
    const resolved = resolveAnnotations(parsed.lyrics.lines, annotations ?? []);
    if (!resolved.ok) throw new ConflictException({ message: 'One or more annotations are invalid', errors: resolved.errors });
    const result = await this.prisma.$transaction(async (tx) => {
      const version = await this.createVersion(tx, submission.songId, parsed.lyrics, resolved.annotations);
      await tx.song.update({ where: { id: submission.songId }, data: { status: 'published', syncedVersionId: parsed.lyrics.syncStatus === 'synchronized' ? version.id : null } });
      await tx.lyricsSubmission.update({ where: { id }, data: { status: 'published', publishedVersionId: version.id, reviewerId: actorId, reviewedAt: new Date(), reviewNote: null } });
      await tx.auditLog.create({ data: { actorId, action: 'lyrics.approved', entity: 'lyrics_submission', entityId: id, meta: { versionId: version.id, annotations: resolved.annotations.length } } });
      return { id, status: 'published', versionId: version.id };
    });

    await this.notify({
      outcome: 'approved',
      submissionId: id,
      recipient: submission.user?.email ?? null,
      songTitle: submission.song.title,
      songSlug: submission.song.slug,
      syncStatus: parsed.lyrics.syncStatus,
    });
    return result;
  }

  async updateLyrics(id: string, markdown: string, actorId: string, annotations?: Annotation[]) {
    const submission = await this.prisma.lyricsSubmission.findUnique({ where: { id }, include: { publishedVersion: { include: { annotations: true } }, song: true } });
    if (!submission) throw new NotFoundException('Lyrics submission not found');
    if (!['pending', 'changes_requested', 'published'].includes(submission.status)) {
      throw new ConflictException('Only pending or published submissions can be edited');
    }
    const parsed = parseLyricsText(markdown);
    if (!parsed.ok) throw new ConflictException({ message: 'The edited lyric text is invalid', errors: parsed.errors });
    const existing = submission.publishedVersion?.annotations.map(({ phrase, explanation, lineIndex }) => ({ phrase, explanation, ...(lineIndex == null ? {} : { lineIndex }) })) ?? [];
    const resolved = resolveAnnotations(parsed.lyrics.lines, annotations ?? existing);
    if (!resolved.ok) throw new ConflictException({ message: 'One or more annotations are invalid', errors: resolved.errors });

    const result = await this.prisma.$transaction(async (tx) => {
      let versionId: string | null = null;
      if (submission.status === 'published') {
        const version = await this.createVersion(tx, submission.songId, parsed.lyrics, resolved.annotations);
        if (submission.publishedVersionId) {
          await tx.lyricVersion.update({ where: { id: submission.publishedVersionId }, data: { published: false } });
        }
        await tx.song.update({ where: { id: submission.songId }, data: { syncedVersionId: parsed.lyrics.syncStatus === 'synchronized' ? version.id : null } });
        await tx.lyricsSubmission.update({ where: { id }, data: { markdown, publishedVersionId: version.id } });
        versionId = version.id;
      } else {
        await tx.lyricsSubmission.update({ where: { id }, data: { markdown } });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: submission.status === 'published' ? 'lyrics.published_version_updated' : 'lyrics.timing_updated',
          entity: 'lyrics_submission',
          entityId: id,
          meta: {
            syncStatus: parsed.lyrics.syncStatus,
            timedLines: parsed.lyrics.lines.filter((line) => line.startMs >= 0).length,
            totalLines: parsed.lyrics.lines.length,
            annotations: resolved.annotations.length,
            ...(versionId ? { versionId } : {}),
          },
        },
      });
      return versionId;
    });
    return {
      id,
      status: submission.status,
      syncStatus: parsed.lyrics.syncStatus,
      timedLines: parsed.lyrics.lines.filter((line) => line.startMs >= 0).length,
      totalLines: parsed.lyrics.lines.length,
      annotations: resolved.annotations,
      ...(result ? { versionId: result } : {}),
    };
  }

  async rejectLyrics(id: string, reason: string, actorId: string) {
    const result = await this.updateSubmission(id, { status: 'rejected', reviewNote: reason, reviewerId: actorId, reviewedAt: new Date() }, actorId, 'lyrics.rejected');
    await this.notifyForSubmission(id, 'rejected', reason);
    return result;
  }

  async requestChanges(id: string, note: string, actorId: string) {
    const result = await this.updateSubmission(id, { status: 'changes_requested', reviewNote: note, reviewerId: actorId, reviewedAt: new Date() }, actorId, 'lyrics.changes_requested');
    await this.notifyForSubmission(id, 'changes_requested', note);
    return result;
  }

  async unpublishLyrics(id: string, reason: string | undefined, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.lyricsSubmission.findUnique({ where: { id }, include: { publishedVersion: true } });
      if (!submission?.publishedVersion) throw new NotFoundException('Published lyrics version not found');
      await tx.lyricVersion.update({ where: { id: submission.publishedVersion.id }, data: { published: false } });
      await tx.song.updateMany({ where: { id: submission.songId, syncedVersionId: submission.publishedVersion.id }, data: { syncedVersionId: null } });
      await tx.lyricsSubmission.update({ where: { id }, data: { status: 'unpublished', reviewNote: reason ?? null, reviewerId: actorId, reviewedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId, action: 'lyrics.unpublished', entity: 'lyrics_submission', entityId: id, meta: { reason: reason ?? null } } });
      return { id, status: 'unpublished' };
    });
  }

  async auditLog(query: { entity?: string; page?: string }) {
    const page = this.page(query.page); const pageSize = 50;
    const where = query.entity ? { entity: query.entity } : {};
    const [total, items] = await Promise.all([this.prisma.auditLog.count({ where }), this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { email: true, displayName: true } } } })]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async changeRole(id: string, role: Role, actorId: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'admin' && role !== 'admin' && await this.prisma.user.count({ where: { role: 'admin' } }) <= 1) throw new ConflictException('The last administrator cannot be demoted');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: { role }, select: { id: true, email: true, displayName: true, role: true } });
      await tx.auditLog.create({ data: { actorId, action: 'user.role_changed', entity: 'user', entityId: id, meta: { from: target.role, to: role } } });
      return user;
    });
  }

  async users() { return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, email: true, displayName: true, role: true, createdAt: true } }); }

  artistSuggestions() { return this.prisma.artistSuggestion.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: 100, include: { submitter: { select: { displayName: true, email: true } } } }); }
  /**
   * Add an artist from a YouTube link and import the channel.
   *
   * The audit row records the channel and the link the admin used, so "where did
   * these 300 drafts come from" is answerable later.
   */
  async addArtist(input: { youtubeChannel: string; name?: string; importAll?: boolean }, actorId: string) {
    const result = await this.artists.createFromChannel(input);
    if (!result.alreadyExists) {
      await this.audit('artist.channel_added', 'artist', result.artist.id, actorId, {
        link: input.youtubeChannel.slice(0, 300),
        channelId: result.channel.channelId,
        importAll: Boolean(input.importAll),
        sync: result.sync,
      });
    }
    return result;
  }

  /**
   * Resolve a pasted link without creating anything.
   *
   * With no API key the honest answer is the setup message, not a generic
   * "verification is not configured" from three layers down.
   */
  previewChannel(reference: string) {
    if (!this.youtube.configured()) {
      throw new ServiceUnavailableException(
        'Reading a YouTube channel needs YOUTUBE_API_KEY. Set it in infra/.env and restart the API.',
      );
    }
    return this.youtube.resolveChannel(reference).then((channel) => ({
      channelId: channel.channelId,
      title: channel.title,
      description: channel.description,
      sampleVideos: channel.sampleVideos,
    }));
  }

  /** Whether acquisition can run at all, and what is already in the catalogue. */
  async acquisitionStatus() {
    const [noChannel, withChannel, importedDrafts, importedPublished] = await Promise.all([
      this.prisma.artist.count({ where: { youtubeChannelId: null } }),
      this.prisma.artist.count({ where: { youtubeChannelId: { not: null } } }),
      this.prisma.song.count({ where: { youtubeImported: true, status: { in: ['draft', 'pending'] } } }),
      this.prisma.song.count({ where: { youtubeImported: true, status: 'published' } }),
    ]);
    return {
      configured: this.youtube.configured(),
      artistsWithoutChannel: noChannel,
      artistsWithChannel: withChannel,
      importedDrafts,
      importedPublished,
      // First-run guidance: a key is only half of it, and a form that cannot
      // import is worse than one that says what is missing.
      ...(this.youtube.configured() ? {} : {
        setup: 'Set YOUTUBE_API_KEY in infra/.env (Google Cloud Console → APIs & Services → enable "YouTube Data API v3" → Credentials → API key), then restart the API.',
      }),
    };
  }
  async approveArtistSuggestion(id: string, actorId: string) { const result = await this.artists.approveSuggestion(id, actorId); await this.audit('artist.suggestion_approved', 'artist_suggestion', id, actorId); return result; }
  async rejectArtistSuggestion(id: string, note: string, actorId: string) { const result = await this.artists.rejectSuggestion(id, actorId, note); await this.audit('artist.suggestion_rejected', 'artist_suggestion', id, actorId); return result; }
  async syncArtist(id: string, actorId: string, options: { importAll?: boolean; restart?: boolean } = {}) {
    const result = await this.youtube.syncArtistNow(id, { force: options.importAll, restart: options.restart });
    await this.audit('artist.youtube_synced', 'artist', id, actorId, {
      ...result,
      importAll: Boolean(options.importAll),
      restart: Boolean(options.restart),
    });
    return result;
  }

  async artistsQueue() {
    const artists = await this.prisma.artist.findMany({
      where: { youtubeChannelId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        youtubeSync: true,
        _count: { select: { songs: true } },
        songs: { select: { song: { select: { status: true, youtubeImported: true } } } },
      },
    });
    return artists.map(({ songs, ...artist }) => ({
      ...artist,
      importedDrafts: songs.filter((credit) => credit.song.youtubeImported && ['draft', 'pending'].includes(credit.song.status)).length,
      importedPublished: songs.filter((credit) => credit.song.youtubeImported && credit.song.status === 'published').length,
    }));
  }

  async songDrafts(query: { artistId?: string } = {}) {
    return this.prisma.song.findMany({
      where: {
        status: { in: ['draft', 'pending'] },
        ...(query.artistId ? { artists: { some: { artistId: query.artistId } } } : {}),
      },
      orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
      take: 300,
      include: { artists: { include: { artist: { select: { name: true } } } } },
    });
  }
  async publishSong(id: string, actorId: string) { const song = await this.prisma.song.findUnique({ where: { id }, select: { id: true, status: true } }); if (!song) throw new NotFoundException('Song not found'); return this.prisma.$transaction(async (tx) => { const updated = await tx.song.update({ where: { id }, data: { status: 'published' } }); await tx.auditLog.create({ data: { actorId, action: 'song.published', entity: 'song', entityId: id } }); return updated; }); }

  private async updateSubmission(id: string, data: Prisma.LyricsSubmissionUpdateInput, actorId: string, action: string) {
    const exists = await this.prisma.lyricsSubmission.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Lyrics submission not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lyricsSubmission.update({ where: { id }, data, select: { id: true, status: true, reviewNote: true } });
      await tx.auditLog.create({ data: { actorId, action, entity: 'lyrics_submission', entityId: id, meta: { note: data.reviewNote } } });
      return updated;
    });
  }
  private async audit(action: string, entity: string, entityId: string, actorId: string | null, meta?: object) { await this.prisma.auditLog.create({ data: { actorId, action, entity, entityId, ...(meta ? { meta } : {}) } }); }

  /**
   * Create the next immutable, published `LyricVersion` for a song.
   *
   * Shared by approval and by editing an already-published version, because the
   * two must produce identical rows — an annotation written by one path and a
   * timing written by the other have to end up in the same shape, and the version
   * number has to advance the same way. Keeping one copy is what makes that true
   * by construction instead of by two blocks staying in step.
   */
  private async createVersion(
    tx: Prisma.TransactionClient,
    songId: string,
    lyrics: { syncStatus: 'synchronized' | 'unsynchronized'; lines: readonly { index: number; startMs: number; text: string }[] },
    annotations: readonly Annotation[],
  ) {
    const latest = await tx.lyricVersion.findFirst({
      where: { songId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return tx.lyricVersion.create({
      data: {
        songId,
        version: (latest?.version ?? 0) + 1,
        syncStatus: lyrics.syncStatus,
        published: true,
        publishedAt: new Date(),
        lines: {
          create: lyrics.lines.map((line) => ({ index: line.index, startMs: line.startMs, text: line.text })),
        },
        annotations: {
          create: annotations.map((annotation) => ({
            phrase: annotation.phrase,
            explanation: annotation.explanation,
            lineIndex: annotation.lineIndex ?? null,
          })),
        },
      },
    });
  }

  /**
   * Notify the contributor of a review outcome, and record whether it went out.
   *
   * Never throws: the review action has committed by this point, and a mail
   * problem must not turn a successful approval into a 500. A skip (guest
   * submission, mock provider) is written to the audit log so the outcome is
   * still traceable.
   */
  private async notify(params: {
    outcome: 'approved' | 'changes_requested' | 'rejected';
    submissionId: string;
    recipient: string | null;
    songTitle: string;
    songSlug?: string;
    note?: string | null;
    syncStatus?: 'synchronized' | 'unsynchronized';
  }) {
    // Same helper the reset and confirmation mails use, so every outgoing link
    // is built from one origin (`NEXT_PUBLIC_SITE_URL`). Reading a different
    // variable here sent contributors to localhost in production.
    const siteUrl = siteUrlFromEnv();
    try {
      const { result } = await this.mail.notifyReviewOutcome({
        outcome: params.outcome,
        recipient: params.recipient,
        songTitle: params.songTitle,
        ...(params.songSlug ? { songUrl: `${siteUrl}/songs/${params.songSlug}` } : {}),
        note: params.note ?? null,
        submissionId: params.submissionId,
        siteUrl,
        ...(params.syncStatus ? { syncStatus: params.syncStatus } : {}),
      });
      await this.audit(`lyrics.notification_${result.delivered ? 'sent' : 'skipped'}`, 'lyrics_submission', params.submissionId, null, {
        outcome: params.outcome,
        provider: result.provider,
        ...(result.skippedReason ? { reason: result.skippedReason } : {}),
      });
    } catch (error) {
      // A notification bug must never surface as a failed review.
      await this.audit('lyrics.notification_failed', 'lyrics_submission', params.submissionId, null, {
        outcome: params.outcome,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Load what `notify` needs for a submission that was just transitioned. */
  private async notifyForSubmission(id: string, outcome: 'changes_requested' | 'rejected', note?: string | null) {
    const submission = await this.prisma.lyricsSubmission.findUnique({
      where: { id },
      select: { id: true, user: { select: { email: true } }, song: { select: { title: true, slug: true } } },
    });
    if (!submission) return;
    await this.notify({
      outcome,
      submissionId: id,
      recipient: submission.user?.email ?? null,
      songTitle: submission.song.title,
      songSlug: submission.song.slug,
      note: note ?? null,
    });
  }
  private page(value?: string) { const n = Number(value ?? 1); return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1; }
}
