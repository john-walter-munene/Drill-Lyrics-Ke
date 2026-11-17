import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { checkResubmission, parseLyricsDocument, parseLyricsText, resubmissionUpdate } from '@drillke/shared';
import { PrismaService } from '../../prisma.service';
import { looksLikeMarkdownDocument } from '../../common/submission-shape';
import type { CreateSubmissionDto } from './dto/create-submission.dto';
import type { ResubmitSubmissionDto } from './dto/resubmit-submission.dto';

@Injectable()
export class LyricsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Validate submitted lyrics with the parser that matches the shape of the
   * body, so a Markdown document is checked for frontmatter and annotations and
   * a text body is not rejected for lacking them. The raw body is stored either
   * way.
   *
   * Shared by create and resubmit: a contributor correcting text under review
   * must face exactly the same rules as one submitting it the first time.
   *
   * The error envelope is built as `{ message, errors }` on purpose. The shared
   * parsers return a per-field map (`{ body: [...], frontmatter: [...] }`), and
   * passing that object straight to `UnprocessableEntityException` made Nest
   * treat it as the response body — so the client got the fields at the TOP
   * level (`"timestamps": [...]`) under a bare "Unprocessable Entity" and the
   * documented `errors` array was never sent.
   */
  private assertReadableLyrics(markdown: string) {
    const invalid = (errors: Record<string, string[]>) => {
      const first = Object.values(errors).flat()[0];
      return new UnprocessableEntityException({
        message: first ?? 'The lyrics could not be read',
        errors,
      });
    };
    if (looksLikeMarkdownDocument(markdown)) {
      const parsed = parseLyricsDocument(markdown);
      if (!parsed.ok) throw invalid(parsed.errors);
    } else {
      const parsed = parseLyricsText(markdown);
      if (!parsed.ok) throw invalid(parsed.errors);
    }
  }

  async createSubmission(dto: CreateSubmissionDto, user?: { id: string; displayName: string }) {
    this.assertReadableLyrics(dto.markdown);

    const song = await this.prisma.song.findFirst({
      where: { id: dto.songId, status: 'published' },
      select: { id: true },
    });
    if (!song) throw new NotFoundException('Choose a published song from the catalogue');

    const submission = await this.prisma.lyricsSubmission.create({
      data: {
        songId: song.id,
        userId: user?.id ?? null,
        markdown: dto.markdown,
        note: dto.note?.trim() || undefined,
        creditPublicly: Boolean(user && dto.creditPublicly),
        contributorName: user && dto.creditPublicly ? user.displayName : null,
        status: 'pending',
      },
      select: { id: true, status: true },
    });
    return submission;
  }

  async mySubmissions(userId?: string) {
    if (!userId) throw new UnauthorizedException('Sign in to view your submissions');
    const items = await this.prisma.lyricsSubmission.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, include: { song: { select: { title: true, slug: true } } } });
    return { items, total: items.length, page: 1, pageSize: 100, totalPages: 1 };
  }

  /**
   * Edit a submission the reviewer asked for changes on, and send it back.
   *
   * Same row, same id, new text — not a new submission. That keeps the review
   * history and the audit trail attached to the contribution the note was about,
   * and it means the queue shows a corrected row instead of a duplicate sitting
   * beside the original.
   *
   * Eligibility lives in `checkResubmission` (shared, unit-tested) so this route
   * and the account page agree on which rows show an Edit control.
   */
  async resubmit(id: string, dto: ResubmitSubmissionDto, userId?: string) {
    const submission = await this.prisma.lyricsSubmission.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, songId: true },
    });

    // A missing row and someone else's row answer the same way, so an id cannot
    // be probed for existence.
    const eligibility = checkResubmission({
      userId,
      ownerId: submission?.userId ?? null,
      status: submission?.status ?? 'unknown',
    });
    if (!eligibility.ok) {
      if (eligibility.reason === 'not_owner') {
        throw userId ? new NotFoundException(eligibility.message) : new UnauthorizedException(eligibility.message);
      }
      throw new ConflictException(eligibility.message);
    }

    // Re-validate as if it were a first submission: the client is never trusted,
    // and the rule must not be looser because a reviewer is waiting on it.
    this.assertReadableLyrics(dto.markdown);

    const status = submission!.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.lyricsSubmission.update({
        where: { id },
        data: {
          markdown: dto.markdown,
          ...(dto.note?.trim() ? { note: dto.note.trim() } : {}),
          ...resubmissionUpdate(status),
        },
        select: { id: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'lyrics.resubmitted',
          entity: 'lyrics_submission',
          entityId: id,
          meta: { from: status, to: 'pending' },
        },
      });
      return row;
    });
    return updated;
  }

  async submissionById(id: string, userId?: string) {
    if (!userId) throw new UnauthorizedException('Sign in to view your submission');
    const item = await this.prisma.lyricsSubmission.findFirst({ where: { id, userId }, include: { song: { select: { title: true, slug: true } } } });
    if (!item) throw new NotFoundException('Submission not found');
    return item;
  }

  async topContributors() {
    const rows = await this.prisma.lyricsSubmission.groupBy({
      by: ['contributorName'],
      where: { creditPublicly: true, status: 'published', contributorName: { not: null } },
      _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 10,
    });
    return { items: rows.filter((row) => row.contributorName).map((row) => ({ name: row.contributorName, publishedContributions: row._count._all })) };
  }
}
