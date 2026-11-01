import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Request } from 'express';
import type { Role } from '@drillke/shared';
import { MAX_ANNOTATION_EXPLANATION, MAX_ANNOTATION_PHRASE } from '@drillke/shared';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { AdminService } from './admin.service';
import { AudioDecodeError, AudioSyncService } from '../../library/audio-sync.service';
import { MAX_CLIP_SAMPLES, SYNC_SAMPLE_RATE } from '../../library/audio-decode';
import { CurrentUser } from '../../common/current-user.decorator';
import type { SessionUser } from '../../common/session-auth.guard';

class RejectLyricsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
class RequestChangesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;
}

class AnnotationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_ANNOTATION_PHRASE)
  phrase!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_ANNOTATION_EXPLANATION)
  explanation!: string;

  @IsOptional()
  @IsInt()
  lineIndex?: number;
}

class UpdateLyricsDto {
  @IsString()
  @MaxLength(512 * 1024)
  markdown!: string;

  // Omit to keep the published version's current annotations.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnotationDto)
  annotations?: AnnotationDto[];
}

class ApproveLyricsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnotationDto)
  annotations?: AnnotationDto[];
}

class UnpublishLyricsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class ChangeRoleDto {
  @IsIn(['member', 'contributor', 'moderator', 'admin'])
  role!: Role;
}
class AddArtistDto {
  // A channel URL/@handle, or a single video URL — the channel is resolved
  // from the video. 300 characters fits any YouTube link with a query string.
  @IsString() @MinLength(1) @MaxLength(300) youtubeChannel!: string;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  /** "Import every upload": also import a non-music channel's odd uploads. */
  @IsOptional() @IsBoolean() importAll?: boolean;
}

class SyncArtistDto {
  /** "Import every upload": also the channel's non-music-shaped uploads. */
  @IsOptional() @IsBoolean() importAll?: boolean;
  /**
   * Start the walk again from the newest upload instead of resuming at the
   * saved token. Needed once YouTube's first run resolved and every song in
   * the channel was not imported: the walk had "completed", and a plain sync
   * otherwise has no pages left to visit.
   */
  @IsOptional() @IsBoolean() restart?: boolean;
}

/**
 * Review + moderation surface. Guards are declared per-route so each action has
 * an explicit minimum role — see docs/api.md §Review.
 */
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly audioSync: AudioSyncService) { }

  @Get('overview')
  @Roles('moderator')
  overview() { return this.admin.overview(); }

  @Get('lyrics/queue')
  @Roles('moderator')
  queue(@Query('status') status?: string) {
    return this.admin.lyricsQueue(status);
  }

  @Post('lyrics/:id/approve')
  @Roles('moderator')
  approve(@Param('id') id: string, @CurrentUser() user: SessionUser, @Body() dto: ApproveLyricsDto) {
    return this.admin.approveLyrics(id, user.id, dto?.annotations);
  }

  @Post('lyrics/:id/sync-estimate')
  @Roles('moderator')
  async estimateLyrics(@Param('id') id: string, @Req() request: Request) {
    const lines = await this.admin.getSubmissionLines(id);
    const contentType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'audio/wav' && contentType !== 'audio/x-wav') {
      throw new HttpException('Upload a WAV audio file for server-side estimation.', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      totalBytes += bytes.length;
      if (totalBytes > MAX_CLIP_SAMPLES * 4 + 1_000_000) {
        throw new HttpException('Audio must be 15 minutes or shorter.', HttpStatus.PAYLOAD_TOO_LARGE);
      }
      chunks.push(bytes);
    }
    try {
      const result = this.audioSync.estimate(Buffer.concat(chunks), lines);
      return { ...result, sampleRate: SYNC_SAMPLE_RATE };
    } catch (error) {
      if (error instanceof AudioDecodeError) {
        const status = error.code === 'UNSUPPORTED_FORMAT' ? HttpStatus.UNSUPPORTED_MEDIA_TYPE : HttpStatus.BAD_REQUEST;
        throw new HttpException(error.message, status);
      }
      throw error;
    }
  }

  @Patch('lyrics/:id')
  @Roles('moderator')
  updateLyrics(@Param('id') id: string, @Body() dto: UpdateLyricsDto, @CurrentUser() user: SessionUser) {
    return this.admin.updateLyrics(id, dto.markdown, user.id, dto.annotations);
  }

  @Post('lyrics/:id/reject')
  @Roles('moderator')
  reject(@Param('id') id: string, @Body() dto: RejectLyricsDto, @CurrentUser() user: SessionUser) {
    return this.admin.rejectLyrics(id, dto.reason, user.id);
  }

  @Post('lyrics/:id/request-changes')
  @Roles('moderator')
  requestChanges(@Param('id') id: string, @Body() dto: RequestChangesDto, @CurrentUser() user: SessionUser) {
    return this.admin.requestChanges(id, dto.note, user.id);
  }

  @Post('lyrics/:id/unpublish')
  @Roles('admin')
  unpublish(@Param('id') id: string, @Body() dto: UnpublishLyricsDto, @CurrentUser() user: SessionUser) {
    return this.admin.unpublishLyrics(id, dto.reason, user.id);
  }

  @Get('audit')
  @Roles('admin')
  audit(@Query('entity') entity?: string, @Query('page') page?: string) {
    return this.admin.auditLog({ entity, page });
  }

  @Patch('users/:id/role')
  @Roles('admin')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto, @CurrentUser() user: SessionUser) {
    return this.admin.changeRole(id, dto.role, user.id);
  }
  @Get('users') @Roles('admin') users() { return this.admin.users(); }

  @Get('artist-suggestions') @Roles('moderator') artistSuggestions() { return this.admin.artistSuggestions(); }
  @Post('artist-suggestions/:id/approve') @Roles('moderator') approveArtist(@Param('id') id: string, @CurrentUser() user: SessionUser) { return this.admin.approveArtistSuggestion(id, user.id); }
  @Post('artist-suggestions/:id/reject') @Roles('moderator') rejectArtist(@Param('id') id: string, @Body() dto: RejectLyricsDto, @CurrentUser() user: SessionUser) { return this.admin.rejectArtistSuggestion(id, dto.reason, user.id); }
  @Post('artists') @Roles('moderator') addArtist(@Body() dto: AddArtistDto, @CurrentUser() user: SessionUser) { return this.admin.addArtist(dto, user.id); }
  @Get('artists') @Roles('moderator') artists() { return this.admin.artistsQueue(); }
  @Post('artists/:id/sync') @Roles('moderator') syncArtist(@Param('id') id: string, @Body() dto: SyncArtistDto, @CurrentUser() user: SessionUser) {
    return this.admin.syncArtist(id, user.id, { importAll: dto?.importAll, restart: dto?.restart });
  }

  /**
   * Acquisition screen state. Sits before `artists/:id/...` so "acquisition" is
   * never parsed as an artist id.
   */
  @Get('acquisition') @Roles('moderator') acquisition() { return this.admin.acquisitionStatus(); }
  /** Preview a channel without adding it: does the link resolve, how big is it? */
  @Post('acquisition/preview') @Roles('moderator') previewArtist(@Body() dto: AddArtistDto) { return this.admin.previewChannel(dto.youtubeChannel); }
  @Get('songs/drafts') @Roles('moderator') songDrafts(@Query('artistId') artistId?: string, @Query('all') all?: string) { return this.admin.songDrafts({ artistId, all: all === 'true' }); }
  @Post('songs/:id/publish') @Roles('moderator') publishSong(@Param('id') id: string, @CurrentUser() user: SessionUser) { return this.admin.publishSong(id, user.id); }
}
