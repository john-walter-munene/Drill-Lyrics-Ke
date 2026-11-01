import { Controller, Get, Param, Query } from '@nestjs/common';
import { SongsService } from './songs.service';

/**
 * Public song catalogue and the single lyrics payload the player consumes.
 * See docs/api.md §Songs & lyrics.
 */
@Controller('songs')
export class SongsController {
  constructor(private readonly songs: SongsService) { }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('artist') artist?: string,
    @Query('page') page?: string,
  ) {
    return this.songs.list({ q, artist, page });
  }

  /**
   * Home-page shelves. Declared **before** `:slug` on purpose: Nest matches in
   * declaration order, so the reverse would treat "feeds" as a song slug.
   */
  @Get('feeds')
  feeds() {
    return this.songs.feeds();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.songs.bySlug(slug);
  }

  /** One payload per song — never one request per lyric line. */
  @Get(':slug/lyrics')
  lyrics(@Param('slug') slug: string) {
    return this.songs.lyrics(slug);
  }
}
