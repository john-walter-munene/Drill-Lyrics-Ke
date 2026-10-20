import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) { }

  create(dto: CreateReportDto) {
    void dto;
    // TODO(phase-2): persist the report and notify moderators.
    throw new NotImplementedException('Reports land in Phase 2');
  }
}
