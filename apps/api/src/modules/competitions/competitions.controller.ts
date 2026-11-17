import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { writeThrottle } from '../../common/throttling';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { SessionUser } from '../../common/session-auth.guard';
import { CompetitionsService } from './competitions.service';

class VoteDto {
  @IsString()
  @MinLength(1)
  entryId!: string;

  /**
   * The browser's device token. Optional so a vote can be cast without one
   * (tests, and browsers that block storage); the live rule only applies when
   * a device is actually presented.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceToken?: string;
}

class AddCommitteeMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['member', 'chair'])
  role?: string;
}

class RemoveCommitteeMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class ResolveTieDto {
  @IsString()
  @MinLength(1)
  entryId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

class InvalidateVoteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/**
 * Competitions and their three-stage voting.
 *
 * Public routes are read-only except `vote`. Everything that changes the shape
 * of a competition — the committee, opening and closing stages, resolving a
 * tie, invalidating a vote — is admin-only and audited.
 */
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitions: CompetitionsService) { }

  @Get()
  list() {
    return this.competitions.list();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string, @CurrentUser() user?: SessionUser) {
    return this.competitions.bySlug(slug, user);
  }

  @Post(':slug/vote')
  @Throttle(writeThrottle())
  vote(@Param('slug') slug: string, @Body() dto: VoteDto, @CurrentUser() user?: SessionUser) {
    return this.competitions.vote(slug, dto, user);
  }

  // --- Admin ----------------------------------------------------------------

  @Post(':slug/committee')
  @Roles('admin')
  @UseGuards(RolesGuard)
  addCommitteeMember(
    @Param('slug') slug: string,
    @Body() dto: AddCommitteeMemberDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.competitions.addCommitteeMember(slug, dto, user.id);
  }

  @Delete(':slug/committee/:userId')
  @Roles('admin')
  @UseGuards(RolesGuard)
  removeCommitteeMember(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() dto: RemoveCommitteeMemberDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.competitions.removeCommitteeMember(slug, userId, dto ?? {}, user.id);
  }

  @Post(':slug/stages/:stageId/open')
  @Roles('admin')
  @UseGuards(RolesGuard)
  openStage(@Param('slug') slug: string, @Param('stageId') stageId: string, @CurrentUser() user: SessionUser) {
    return this.competitions.openStage(slug, stageId, user.id);
  }

  @Post(':slug/stages/:stageId/close')
  @Roles('admin')
  @UseGuards(RolesGuard)
  closeStage(@Param('slug') slug: string, @Param('stageId') stageId: string, @CurrentUser() user: SessionUser) {
    return this.competitions.closeStage(slug, stageId, user.id);
  }

  @Post(':slug/stages/:stageId/tiebreak')
  @Roles('admin')
  @UseGuards(RolesGuard)
  resolveTie(
    @Param('slug') slug: string,
    @Param('stageId') stageId: string,
    @Body() dto: ResolveTieDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.competitions.resolveTie(slug, stageId, dto, user.id);
  }

  @Get(':slug/stages/:stageId/votes')
  @Roles('admin')
  @UseGuards(RolesGuard)
  voteLedger(@Param('slug') slug: string, @Param('stageId') stageId: string) {
    return this.competitions.voteLedger(slug, stageId);
  }

  @Post(':slug/votes/:voteId/invalidate')
  @Roles('admin')
  @UseGuards(RolesGuard)
  invalidateVote(
    @Param('slug') slug: string,
    @Param('voteId') voteId: string,
    @Body() dto: InvalidateVoteDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.competitions.invalidateVote(slug, voteId, dto, user.id);
  }
}
