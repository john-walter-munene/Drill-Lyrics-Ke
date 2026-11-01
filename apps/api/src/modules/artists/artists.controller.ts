import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { writeThrottle } from '../../common/throttling';
import { CurrentUser } from '../../common/current-user.decorator';
import type { SessionUser } from '../../common/session-auth.guard';
import { ArtistsService } from './artists.service';

class SuggestArtistDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  youtubeChannel!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  suggestedName?: string;
}

/**
 * Public artist directory and profiles. Song lists are published-only; an
 * artist page itself exists as soon as the artist has a YouTube channel — see
 * docs/api.md §Artists.
 */
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Post('suggestions')
  @Throttle(writeThrottle())
  suggest(@Body() dto: SuggestArtistDto, @CurrentUser() user?: SessionUser) {
    return this.artists.submitChannelSuggestion(dto, user?.id);
  }

  @Get()
  list(@Query('q') q?: string, @Query('page') page?: string) {
    return this.artists.list({ q, page });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.artists.bySlug(slug);
  }

  @Get(':slug/songs')
  songs(@Param('slug') slug: string, @Query('page') page?: string) {
    return this.artists.songs(slug, { page });
  }
}
