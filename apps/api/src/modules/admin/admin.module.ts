import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ArtistsModule } from '../artists/artists.module';
import { YoutubeSyncModule } from '../../workers/youtube-sync.module';
import { AudioSyncService } from '../../library/audio-sync.service';
import { MailModule } from '../mail/mail.module';

@Module({
  controllers: [AdminController],
  imports: [ArtistsModule, YoutubeSyncModule, MailModule],
  providers: [AdminService, PrismaService, AudioSyncService],
})
export class AdminModule { }
