import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

/**
 * Cross-entity search across songs, artists, DJs, podcasts and events.
 * Minimum query length is 2 characters. See docs/api.md §Search.
 */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) { }

  @Get()
  query(
    @Query('q') q?: string,
    @Query('types') types?: string,
  ) {
    return this.search.search({ q, types });
  }
}
