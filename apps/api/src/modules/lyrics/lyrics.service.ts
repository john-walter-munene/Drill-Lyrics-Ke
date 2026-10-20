import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { CreateSubmissionDto } from './dto/create-submission.dto';

/**
 * Lyrics submission + review logic.
 *
 * Phase 1: parse Markdown with `@drillke/shared`, reject with 422 field errors,
 * then persist a `LyricsSubmission` with status `pending`.
 * Phase 2: approval creates an immutable `LyricVersion` (version = max + 1) and
 * flips its `published` flag; previous versions stay queryable for rollback.
 */
@Injectable()
export class LyricsService {
  constructor(private readonly prisma: PrismaService) { }

  createSubmission(dto: CreateSubmissionDto) {
    void dto;
    throw new NotImplementedException('Lyrics submission lands in Phase 1');
  }

  mySubmissions() {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  submissionById(id: string) {
    void id;
    throw new NotImplementedException('Submission lookup lands in Phase 1');
  }
}
