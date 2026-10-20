import { Controller, Get, OnModuleDestroy, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../../prisma.service';

/**
 * Liveness/readiness probes for load balancers and uptime monitors.
 * `/health` is a cheap liveness check that never touches a dependency;
 * `/health/ready` verifies database connectivity and answers 503 when it is
 * down so the orchestrator stops routing traffic here.
 */
@Controller('health')
@SkipThrottle()
export class HealthController implements OnModuleDestroy {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) { }

  @Get()
  live() {
    return {
      status: 'ok',
      service: 'drillke-api',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, 'ok' | 'down'> = { database: 'down' };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
    }
    const ok = Object.values(checks).every((c) => c === 'ok');
    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
  }

  async onModuleDestroy(): Promise<void> {
    // Connections are owned by PrismaService; nothing to release here yet.
  }
}
