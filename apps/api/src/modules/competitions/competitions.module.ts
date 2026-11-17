import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CompetitionsController } from './competitions.controller';
import { CompetitionsService } from './competitions.service';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService, PrismaService],
  exports: [CompetitionsService],
})
export class CompetitionsModule { }
