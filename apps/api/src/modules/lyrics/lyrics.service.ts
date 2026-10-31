import { Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { parseLyricsDocument, parseLyricsText } from '@drillke/shared';
import { PrismaService } from '../../prisma.service';
import { looksLikeMarkdownDocument } from '../../common/submission-shape';
import type { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class LyricsService {
  constructor(private readonly prisma: PrismaService) { }

  async createSubmission(dto: CreateSubmissionDto, user?: { id: string; displayName: string }) {
    // Validate with the parser that matches the shape of the body, so a Markdown
    // document is checked for frontmatter and annotations and a text body is not
    // rejected for lacking them. The raw body is stored either way.
    if (looksLikeMarkdownDocument(dto.markdown)) {
      const parsed = parseLyricsDocument(dto.markdown);
      if (!parsed.ok) throw new UnprocessableEntityException(parsed.errors);
    } else {
      const parsed = parseLyricsText(dto.markdown);
      if (!parsed.ok) throw new UnprocessableEntityException(parsed.errors);
    }

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
