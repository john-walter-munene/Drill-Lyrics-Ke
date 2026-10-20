import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PodcastsController } from './podcasts.controller';
import { PodcastsService } from './podcasts.service';

@Module({
  controllers: [PodcastsController],
  providers: [PodcastsService, PrismaService],
  exports: [PodcastsService],
})
export class PodcastsModule { }
