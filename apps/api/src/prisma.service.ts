import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Postgres error codes that mean "the database is unreachable", not "this query
 * is wrong": bad credentials, host down, database missing.
 */
const UNREACHABLE_CODES = new Set(['P1000', 'P1001', 'P1003', 'P1010']);

const DB_DOWN_HINT =
  'Database unreachable. Start it with `npm run db:up`, or run the full Docker stack with `npm run dev:stack`.';

export function isDatabaseUnreachable(err: unknown): boolean {
  const code = (err as { errorCode?: string })?.errorCode;
  return !!code && UNREACHABLE_CODES.has(code);
}

/**
 * Prisma client bound to the Nest lifecycle.
 *
 * A missing database must NOT stop the process: liveness (`/api/health`) stays
 * up while readiness (`/api/health/ready`) reports 503, which is exactly what an
 * orchestrator needs. The API then recovers on its own once Postgres is up,
 * instead of crash-looping.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger('Prisma');

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (err) {
      if (!isDatabaseUnreachable(err)) throw err;
      this.log.warn(DB_DOWN_HINT);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
