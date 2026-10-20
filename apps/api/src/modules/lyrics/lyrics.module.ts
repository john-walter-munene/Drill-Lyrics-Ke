import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LyricsController } from './lyrics.controller';
import { LyricsService } from './lyrics.service';

@Module({
  controllers: [LyricsController],
  providers: [LyricsService, PrismaService],
  exports: [LyricsService],
})
export class LyricsModule { }
