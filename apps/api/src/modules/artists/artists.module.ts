








import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { YoutubeSyncModule } from '../../workers/youtube-sync.module';

@Module({
  imports: [YoutubeSyncModule],
  controllers: [ArtistsController],
  providers: [ArtistsService, PrismaService],
  exports: [ArtistsService],
})
export class ArtistsModule { }
