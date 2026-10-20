import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Role } from '@drillke/shared';
import { PrismaService } from '../../prisma.service';

/**
 * Moderation and review. Every mutating action here must:
 *   1. write an `AuditLog` row, and
 *   2. bump `Song.syncedVersionId` when a synchronized version is published.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) { }

  lyricsQueue(status?: string) {
    void status;
    // TODO(phase-2): pending submissions, oldest first.
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  }

  approveLyrics(id: string) {
    void id;
    // TODO(phase-2): create LyricVersion (max + 1), publish, audit.
    throw new NotImplementedException('Review lands in Phase 2');
  }

  rejectLyrics(id: string, reason: string) {
    void id;
    void reason;
    throw new NotImplementedException('Review lands in Phase 2');
  }

  requestChanges(id: string, note: string) {
    void id;
    void note;
    throw new NotImplementedException('Review lands in Phase 2');
  }

  unpublishLyrics(id: string, reason?: string) {
    void id;
    void reason;
    // TODO(phase-2): unpublish the version, audit, and keep the submission row.
    throw new NotImplementedException('Unpublish lands in Phase 2');
  }

  auditLog(query: { entity?: string; page?: string }) {
    void query;
    return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
  }

  changeRole(id: string, role: Role) {
    void id;
    void role;
    // TODO(phase-2): guard against removing the last admin; audit.
    throw new NotImplementedException('Role changes land in Phase 2');
  }
}
