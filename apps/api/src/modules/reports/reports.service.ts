import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';
import { appendDetail } from './report-detail';

/**
 * Reports against any catalogue entity (`docs/product.md` §5.4).
 *
 * This is the takedown/report path: "a rights-holder request unpublishes first
 * and asks questions later". The report itself never changes publication state —
 * a moderator decides that in the admin queue — but it must be recorded, so a
 * rights-holder request is never lost in an inbox.
 *
 * Duplicate open reports for the same target are collapsed into one row: ten
 * people reporting the same wrong lyric is one problem, not ten, and the counter
 * is what makes severity visible.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateReportDto, reporterId: string | null) {
    // The target must exist. A report against a deleted or mistyped id is a
    // dead end for a moderator, so it is rejected rather than stored.
    if (!(await this.targetExists(dto.targetType, dto.targetId))) {
      throw new NotFoundException(`No ${dto.targetType.replace('_', ' ')} matches that id`);
    }

    const existing = await this.prisma.report.findFirst({
      where: { targetType: dto.targetType, targetId: dto.targetId, status: 'open' },
      select: { id: true, detail: true },
    });

    if (existing) {
      // Same problem, another voice: keep one row and record the extra report in
      // the detail so a moderator can see how many people raised it. The stored
      // detail is the *first* reporter's words and must be kept — overwriting it
      // would destroy the original statement a moderator needs to act on.
      const updated = await this.prisma.report.update({
        where: { id: existing.id },
        data: { detail: appendDetail(existing.detail, dto) },
        select: { id: true, status: true },
      });
      return { ...updated, duplicate: true };
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim(),
        detail: dto.detail?.trim() || null,
        status: 'open',
      },
      select: { id: true, status: true },
    });
    return { ...report, duplicate: false };
  }

  /** Does the reported entity exist? Cheap `select: { id }` per target type. */
  private async targetExists(type: CreateReportDto['targetType'], id: string): Promise<boolean> {
    const find = { select: { id: true } } as const;
    switch (type) {
      case 'song': return Boolean(await this.prisma.song.findUnique({ where: { id }, ...find }));
      case 'lyric_version': return Boolean(await this.prisma.lyricVersion.findUnique({ where: { id }, ...find }));
      case 'annotation': return Boolean(await this.prisma.annotation.findUnique({ where: { id }, ...find }));
      case 'artist': return Boolean(await this.prisma.artist.findUnique({ where: { id }, ...find }));
      case 'dj': return Boolean(await this.prisma.dj.findUnique({ where: { id }, ...find }));
      case 'podcast_episode': return Boolean(await this.prisma.podcastEpisode.findUnique({ where: { id }, ...find }));
      case 'event': return Boolean(await this.prisma.event.findUnique({ where: { id }, ...find }));
      case 'user': return Boolean(await this.prisma.user.findUnique({ where: { id }, ...find }));
      default: return false;
    }
  }
}
