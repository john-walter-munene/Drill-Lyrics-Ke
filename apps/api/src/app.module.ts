import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { globalThrottleRule } from './common/throttling';
import { RolesGuard } from './common/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ArtistsModule } from './modules/artists/artists.module';
import { SongsModule } from './modules/songs/songs.module';
import { LyricsModule } from './modules/lyrics/lyrics.module';
import { SearchModule } from './modules/search/search.module';
import { DjsModule } from './modules/djs/djs.module';
import { PodcastsModule } from './modules/podcasts/podcasts.module';
import { EventsModule } from './modules/events/events.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { YoutubeSyncModule } from './workers/youtube-sync.module';

/**
 * Modular monolith root. Each feature is a Nest module with a clear boundary
 * (see docs/architecture.md §3).
 */
@Module({
  imports: [
    // Global rate limiting: 120 requests / minute / IP by default.
    // Sensitive routes (auth, submissions, reports) tighten this further via
    // @Throttle overrides from common/throttling.ts.
    ThrottlerModule.forRoot([globalThrottleRule()]),
    HealthModule,
    AuthModule,
    ArtistsModule,
    SongsModule,
    LyricsModule,
    SearchModule,
    DjsModule,
    PodcastsModule,
    EventsModule,
    ReportsModule,
    AdminModule,
    YoutubeSyncModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Request correlation middleware is added with the logging work (Phase 1),
    // mirroring apps/api/src/common/logging/correlation.middleware.ts.
  }
}
