import { Controller, Get, Param, Query } from '@nestjs/common';
import { DjsService } from './djs.service';

/** DJ directory and profiles. DJs link out to their mixes — nothing is hosted. */
@Controller('djs')
export class DjsController {
  constructor(private readonly djs: DjsService) { }

  @Get()
  list(@Query('city') city?: string, @Query('page') page?: string) {
    return this.djs.list({ city, page });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.djs.bySlug(slug);
  }
}
