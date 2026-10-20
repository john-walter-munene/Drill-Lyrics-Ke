import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { writeThrottle } from '../../common/throttling';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

/**
 * Reports against any entity. Signed-in members only, tightly throttled —
 * this is the takedown/report path described in docs/product.md §5.4.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('member')
  @Throttle(writeThrottle())
  create(@Body() dto: CreateReportDto) {
    return this.reports.create(dto);
  }
}
