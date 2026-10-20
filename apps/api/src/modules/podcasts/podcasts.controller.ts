import { Controller, Get, Param, Query } from '@nestjs/common';
import { PodcastsService } from './podcasts.service';

/** Drill podcasts. Episodes reference external video/audio — nothing is hosted. */
@Controller('podcasts')
export class PodcastsController {
  constructor(private readonly podcasts: PodcastsService) { }

  @Get()
  list(@Query('page') page?: string) {
    return this.podcasts.list({ page });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.podcasts.bySlug(slug);
  }

  @Get(':slug/episodes/:number')
  episode(@Param('slug') slug: string, @Param('number') number: string) {
    return this.podcasts.episode(slug, Number(number));
  }
}
