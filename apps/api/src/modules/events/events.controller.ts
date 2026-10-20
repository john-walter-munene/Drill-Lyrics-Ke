import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';

/**
 * Drill events. Informational only — `ticketUrl` is always an outbound link,
 * never a payment (docs/product.md §5.2).
 */
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) { }

  @Get()
  list(
    @Query('from') from?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
  ) {
    return this.events.list({ from, city, page });
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.events.bySlug(slug);
  }
}
