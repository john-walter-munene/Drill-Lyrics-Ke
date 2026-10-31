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
import { CurrentUser } from '../../common/current-user.decorator';
import type { SessionUser } from '../../common/session-auth.guard';

/**
 * Lyrics contribution endpoints. Submissions are always re-validated
 * server-side with the shared parser — never trust the client.
 *
 * The initial contribution form is guest-friendly; writes remain throttled and
 * all submitted lines are validated server-side. Account history comes later.
 */
@Controller('lyrics')
export class LyricsController {
  constructor(private readonly lyrics: LyricsService) { }

  @Get('contributors/top')
  topContributors() { return this.lyrics.topContributors(); }

  @Post('submissions')
  @Throttle(writeThrottle())
  create(@Body() dto: CreateSubmissionDto, @CurrentUser() user?: SessionUser) {
    return this.lyrics.createSubmission(dto, user);
  }

  @Get('submissions/mine')
  @UseGuards(RolesGuard)
  @Roles('member')
  @SkipThrottle()
  mine(@CurrentUser() user?: SessionUser) {
    return this.lyrics.mySubmissions(user?.id);
  }

  @Get('submissions/:id')
  @UseGuards(RolesGuard)
  @Roles('member')
  @SkipThrottle()
  byId(@Param('id') id: string, @CurrentUser() user?: SessionUser) {
    return this.lyrics.submissionById(id, user?.id);
  }
}

/** Review queue lives under /api/admin/lyrics — see modules/admin. */
export const LYRICS_REVIEW_ROLE: Role = 'moderator';
