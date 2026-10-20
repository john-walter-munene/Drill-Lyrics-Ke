import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { YoutubeSyncService } from './youtube-sync.service';

@Module({
  providers: [YoutubeSyncService, PrismaService],
  exports: [YoutubeSyncService],
})
export class YoutubeSyncModule { }
