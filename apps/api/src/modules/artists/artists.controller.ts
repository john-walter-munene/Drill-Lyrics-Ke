import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArtistsService } from './artists.service';

/**
 * Public artist directory and profiles. Published songs only — see
 * docs/api.md §Artists.
 */
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

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
