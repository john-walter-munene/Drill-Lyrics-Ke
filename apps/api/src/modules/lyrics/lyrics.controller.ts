import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Role } from '@drillke/shared';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { writeThrottle } from '../../common/throttling';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { LyricsService } from './lyrics.service';

/**
 * Lyrics contribution endpoints. Submissions are always re-validated
 * server-side with the shared parser — never trust the client.
 *
 * Authentication (session cookie → `req.user`) lands in Phase 1; the role
 * decorators below already describe the intended access rules.
 */
@Controller('lyrics')
export class LyricsController {
  constructor(private readonly lyrics: LyricsService) { }

  @Post('submissions')
  @UseGuards(RolesGuard)
  @Roles('member')
  @Throttle(writeThrottle())
  create(@Body() dto: CreateSubmissionDto) {
    return this.lyrics.createSubmission(dto);
  }

  @Get('submissions/mine')
  @UseGuards(RolesGuard)
  @Roles('member')
  @SkipThrottle()
  mine() {
    return this.lyrics.mySubmissions();
  }

  @Get('submissions/:id')
  @UseGuards(RolesGuard)
  @Roles('member')
  @SkipThrottle()
  byId(@Param('id') id: string) {
    return this.lyrics.submissionById(id);
  }
}

/** Review queue lives under /api/admin/lyrics — see modules/admin. */
export const LYRICS_REVIEW_ROLE: Role = 'moderator';
