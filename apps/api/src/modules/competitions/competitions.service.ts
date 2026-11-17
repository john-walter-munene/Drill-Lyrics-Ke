import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  advancingEntries,
  canCloseStage,
  canOpenStage,
  competitionWinner,
  deviceVoteDecision,
  STAGE_LABELS,
  type CompetitionStageKind,
  type StageTally,
} from '@drillke/shared';
import { PrismaService } from '../../prisma.service';
import { registeredDeviceHash, tallyCompetition, tallyLoadedStage, type StageWithEntrants } from './competition-tally';

/**
 * Playlist competitions with three-stage voting.
 *
 * The lifecycle is explicit, never timer-driven: an admin opens a stage, voters
 * vote, an admin closes it, and the advancers become the next stage's entrants.
 * Nothing advances on a clock the organiser did not set, and every privileged
 * action is written to the audit log.
 *
 * Visibility is the other half of the design. A stage's results are public as
 * soon as it is closed — the quarterfinal stays readable while the final is
 * being voted on — so the whole path to the winner can be checked by anyone.
 */
@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) { }

  // --- Public ---------------------------------------------------------------

  /** Published competitions, newest first. Drafts are never listed. */
  async list() {
    const competitions = await this.prisma.competition.findMany({
      where: { status: { not: 'draft' } },
      orderBy: { createdAt: 'desc' },
      include: { stages: { orderBy: { order: 'asc' }, select: { kind: true, status: true, title: true } } },
    });
    return {
      items: competitions.map((competition) => ({
        slug: competition.slug,
        title: competition.title,
        description: competition.description,
        organizer: competition.organizer,
        status: competition.status,
        stages: competition.stages,
      })),
    };
  }

  /**
   * One competition with every stage tallied.
   *
   * `viewer` decides what extra detail is included: a committee member sees
   * whether they have voted, and an admin sees the committee roster. The tallies
   * themselves are identical for everyone.
   */
  async bySlug(slug: string, viewer?: { id: string; role: string }) {
    const competition = await this.prisma.competition.findUnique({
      where: { slug },
      include: {
        entries: { orderBy: { title: 'asc' } },
        stages: {
          orderBy: { order: 'asc' },
          include: { entrants: { include: { entry: { select: { id: true, title: true, curator: true } } } } },
        },
      },
    });
    if (!competition) throw new NotFoundException('Competition not found');

    const isStaff = viewer?.role === 'admin' || viewer?.role === 'moderator';
    if (competition.status === 'draft' && !isStaff) {
      throw new NotFoundException('Competition not found');
    }

    const tallies: StageTally[] = [];
    for (const stage of competition.stages) {
      tallies.push(await tallyLoadedStage(this.prisma, stage as StageWithEntrants));
    }

    const currentStage = tallies.find((tally) => tally.status === 'voting_open') ?? null;
    const committee = await this.committeeRoster(competition.id);
    const isCommitteeMember = Boolean(viewer && committee.active.some((member) => member.userId === viewer.id));

    let myVote: { stageId: string; entryId: string } | null = null;
    if (viewer && currentStage) {
      const vote = await this.prisma.competitionVote.findUnique({
        where: { stageId_voterKey: { stageId: currentStage.stageId, voterKey: viewer.id } },
        select: { stageId: true, entryId: true },
      });
      myVote = vote ?? null;
    }

    return {
      slug: competition.slug,
      title: competition.title,
      description: competition.description,
      organizer: competition.organizer,
      status: competition.status,
      voterScope: competition.voterScope,
      allowVoteChange: competition.allowVoteChange,
      startsAt: competition.startsAt?.toISOString() ?? null,
      endsAt: competition.endsAt?.toISOString() ?? null,
      entries: competition.entries.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        title: entry.title,
        curator: entry.curator,
        description: entry.description,
        imageUrl: entry.imageUrl,
      })),
      stages: tallies,
      currentStage,
      winnerEntryId: competitionWinner(tallies),
      committee: {
        active: committee.active.map(({ userId, displayName, role, addedAt }) => ({ userId, displayName, role, addedAt })),
        removed: isStaff ? committee.removed : [],
      },
      viewer: viewer
        ? {
          isCommitteeMember,
          isAdmin: viewer.role === 'admin',
          myVote,
          canVote: this.canVote(competition.voterScope, isCommitteeMember),
        }
        : { isCommitteeMember: false, isAdmin: false, myVote: null, canVote: competition.voterScope === 'public' },
    };
  }

  // --- Voting ---------------------------------------------------------------

  /**
   * Cast a vote in the open stage.
   *
   * The identity a vote is counted against (`voterKey`) is the account id for
   * account and committee voting, and a device fingerprint for public voting.
   * The unique key (stage, voterKey) is what makes a second vote impossible —
   * the database refuses it, not just this method.
   */
  async vote(
    slug: string,
    input: { entryId: string; deviceToken?: string | null },
    viewer?: { id: string; role: string },
  ) {
    const competition = await this.prisma.competition.findUnique({
      where: { slug },
      include: { stages: { where: { status: 'voting_open' }, include: { entrants: true } } },
    });
    if (!competition) throw new NotFoundException('Competition not found');

    const stage = competition.stages[0];
    if (!stage) throw new BadRequestException('No stage is open for voting right now.');

    const entrant = stage.entrants.find((row) => row.entryId === input.entryId);
    if (!entrant) throw new BadRequestException('That entry is not in the open stage.');

    const committee = await this.committeeRoster(competition.id);
    const isCommitteeMember = Boolean(viewer && committee.active.some((member) => member.userId === viewer.id));

    if (!this.canVote(competition.voterScope, isCommitteeMember)) {
      throw new ForbiddenException(
        competition.voterScope === 'committee'
          ? 'Only appointed committee members can vote in this competition.'
          : 'Sign in to vote in this competition.',
      );
    }

    const deviceHash = input.deviceToken ? hashDevice(input.deviceToken) : null;
    const voterKey = competition.voterScope === 'public'
      ? `device:${deviceHash ?? 'anonymous'}`
      : viewer!.id;

    // Live rule: one device per account. Enforced only when a device is
    // presented, so seeded and test votes (which have no device) still work.
    if (viewer) {
      const decision = deviceVoteDecision({
        enforceDevice: true,
        presentedDeviceHash: deviceHash,
        registeredDeviceHash: await registeredDeviceHash(this.prisma, competition.id, viewer.id),
      });
      if (!decision.ok) throw new ConflictException(decision.reason);
    }

    const existing = await this.prisma.competitionVote.findUnique({
      where: { stageId_voterKey: { stageId: stage.id, voterKey } },
    });

    if (existing) {
      if (!competition.allowVoteChange) {
        throw new ConflictException('You have already voted in this stage.');
      }
      const updated = await this.prisma.competitionVote.update({
        where: { id: existing.id },
        data: { entryId: input.entryId, deviceHash: deviceHash ?? existing.deviceHash },
      });
      return { ok: true, changed: true, vote: { stageId: updated.stageId, entryId: updated.entryId } };
    }

    try {
      const created = await this.prisma.competitionVote.create({
        data: {
          competitionId: competition.id,
          stageId: stage.id,
          entryId: input.entryId,
          userId: viewer?.id ?? null,
          voterKey,
          method: competition.voterScope === 'public' ? 'device' : 'account',
          deviceHash,
        },
      });
      return { ok: true, changed: false, vote: { stageId: created.stageId, entryId: created.entryId } };
    } catch (error) {
      // Two requests racing on the same voter: the unique index is the arbiter.
      if (isUniqueViolation(error)) throw new ConflictException('You have already voted in this stage.');
      throw error;
    }
  }

  // --- Admin: committee -----------------------------------------------------

  /**
   * Appoint a committee member. Idempotent: re-adding someone who was removed
   * restores their membership rather than failing on the unique key.
   */
  async addCommitteeMember(slug: string, input: { email: string; role?: string }, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) throw new NotFoundException('No account uses that email address.');

    const existing = await this.prisma.competitionCommitteeMember.findUnique({
      where: { competitionId_userId: { competitionId: competition.id, userId: user.id } },
    });

    if (existing && !existing.removedAt) {
      throw new ConflictException(`${user.displayName} is already on the committee.`);
    }

    const member = existing
      ? await this.prisma.competitionCommitteeMember.update({
        where: { id: existing.id },
        data: { removedAt: null, removedById: null, removalReason: null, role: input.role ?? 'member', addedById: actorId, addedAt: new Date() },
      })
      : await this.prisma.competitionCommitteeMember.create({
        data: { competitionId: competition.id, userId: user.id, role: input.role ?? 'member', addedById: actorId },
      });

    await this.audit(actorId, 'competition.committee.add', competition.id, {
      userId: user.id,
      email: user.email,
      role: member.role,
      restored: Boolean(existing),
    });

    return { ok: true, member: { userId: user.id, displayName: user.displayName, role: member.role } };
  }

  /**
   * Remove a committee member. A soft delete: the row stays so their past votes
   * remain attributable, but they can no longer vote or see the committee view.
   */
  async removeCommitteeMember(slug: string, userId: string, input: { reason?: string }, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const member = await this.prisma.competitionCommitteeMember.findUnique({
      where: { competitionId_userId: { competitionId: competition.id, userId } },
      include: { user: { select: { displayName: true, email: true } } },
    });
    if (!member || member.removedAt) {
      throw new NotFoundException('That account is not an active committee member.');
    }

    await this.prisma.competitionCommitteeMember.update({
      where: { id: member.id },
      data: { removedAt: new Date(), removedById: actorId, removalReason: input.reason ?? null },
    });

    await this.audit(actorId, 'competition.committee.remove', competition.id, {
      userId,
      email: member.user.email,
      reason: input.reason ?? null,
    });

    return { ok: true };
  }

  // --- Admin: stages --------------------------------------------------------

  /**
   * Open a stage for voting.
   *
   * The first stage opens as soon as it has entrants. Every later stage opens
   * only when the previous one is closed with a decided cut, and its entrants
   * are replaced by the previous stage's advancers — so a semifinal can never be
   * opened on a half-counted quarterfinal.
   */
  async openStage(slug: string, stageId: string, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const tallies = await tallyCompetition(this.prisma, competition.id);
    const index = tallies.findIndex((tally) => tally.stageId === stageId);
    if (index === -1) throw new NotFoundException('Stage not found');

    const tally = tallies[index];
    const previous = index > 0 ? tallies[index - 1] : null;
    const check = canOpenStage({ order: tally.order, entrants: tally.standings.length }, previous);
    if (!check.ok) throw new BadRequestException(check.reason);

    if (tally.status === 'voting_open') throw new ConflictException('This stage is already open.');
    if (tally.status === 'completed') throw new ConflictException('This stage is already complete.');

    // A later stage's entrants are the previous stage's advancers. Replacing
    // them on open keeps the bracket honest even if the previous stage was
    // re-closed after a correction.
    if (previous) {
      const advancers = advancingEntries(previous);
      if (advancers.length === 0) {
        throw new BadRequestException('The previous stage has no advancers to carry forward.');
      }
      await this.prisma.$transaction([
        this.prisma.competitionStageEntrant.deleteMany({ where: { stageId } }),
        this.prisma.competitionStageEntrant.createMany({
          data: advancers.map((entryId, position) => ({ stageId, entryId, position })),
        }),
        this.prisma.competitionStage.update({
          where: { id: stageId },
          data: { status: 'voting_open', opensAt: new Date() },
        }),
        this.prisma.competition.update({
          where: { id: competition.id },
          data: { status: 'voting_open' },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.competitionStage.update({
          where: { id: stageId },
          data: { status: 'voting_open', opensAt: new Date() },
        }),
        this.prisma.competition.update({
          where: { id: competition.id },
          data: { status: 'voting_open' },
        }),
      ]);
    }

    await this.audit(actorId, 'competition.stage.open', competition.id, { stageId, kind: tally.kind });
    return { ok: true, stage: await this.stageAfterChange(competition.id, stageId) };
  }

  /**
   * Close a stage and freeze its result.
   *
   * A stage with no votes is refused: closing it would advance whoever happened
   * to be listed first. A tie across the cut line is allowed to close — the
   * result is published as a tie — but the next stage cannot open until an
   * admin resolves it.
   */
  async closeStage(slug: string, stageId: string, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const tallies = await tallyCompetition(this.prisma, competition.id);
    const tally = tallies.find((row) => row.stageId === stageId);
    if (!tally) throw new NotFoundException('Stage not found');

    const check = canCloseStage(tally);
    if (!check.ok) throw new BadRequestException(check.reason);

    const isFinal = tally.kind === 'final';
    await this.prisma.$transaction([
      this.prisma.competitionStage.update({
        where: { id: stageId },
        data: { status: isFinal ? 'completed' : 'voting_closed', closesAt: new Date() },
      }),
      this.prisma.competition.update({
        where: { id: competition.id },
        data: { status: isFinal ? 'results_published' : 'voting_closed' },
      }),
    ]);

    await this.audit(actorId, 'competition.stage.close', competition.id, {
      stageId,
      kind: tally.kind,
      totalVotes: tally.totalVotes,
      tiedAtCutoff: tally.tiedAtCutoff,
    });

    return { ok: true, stage: await this.stageAfterChange(competition.id, stageId) };
  }

  /**
   * Resolve a tie across the cut line.
   *
   * The organiser names the entrant that advances. This is the one place a
   * human decides a result, so it is recorded with the actor and the reason and
   * is visible in the audit log.
   */
  async resolveTie(slug: string, stageId: string, input: { entryId: string; reason: string }, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const tallies = await tallyCompetition(this.prisma, competition.id);
    const tally = tallies.find((row) => row.stageId === stageId);
    if (!tally) throw new NotFoundException('Stage not found');
    if (!tally.tiedAtCutoff) throw new BadRequestException('This stage is not tied across its cut line.');

    const tied = tally.standings.filter((standing) => standing.rank === tally.advancing);
    if (!tied.some((standing) => standing.entryId === input.entryId)) {
      throw new BadRequestException('That entry is not part of the tie.');
    }

    // Record the decision on the stage so the next open carries the right
    // entrants forward, and keep the reason in the audit trail.
    await this.prisma.competitionStage.update({
      where: { id: stageId },
      data: { tiebreakEntryId: input.entryId, tiebreakReason: input.reason, tiebreakById: actorId },
    });
    await this.audit(actorId, 'competition.stage.tiebreak', competition.id, {
      stageId,
      entryId: input.entryId,
      reason: input.reason,
    });

    return { ok: true, stage: await this.stageAfterChange(competition.id, stageId) };
  }

  // --- Admin: votes ---------------------------------------------------------

  /** Invalidate a vote. It stays in the table but stops counting everywhere. */
  async invalidateVote(slug: string, voteId: string, input: { reason: string }, actorId: string) {
    const competition = await this.requireCompetition(slug);
    const vote = await this.prisma.competitionVote.findFirst({
      where: { id: voteId, competitionId: competition.id },
    });
    if (!vote) throw new NotFoundException('Vote not found');
    if (vote.invalidatedAt) throw new ConflictException('That vote is already invalidated.');

    await this.prisma.competitionVote.update({
      where: { id: voteId },
      data: { invalidatedAt: new Date(), invalidatedById: actorId },
    });
    await this.audit(actorId, 'competition.vote.invalidate', competition.id, {
      voteId,
      stageId: vote.stageId,
      entryId: vote.entryId,
      reason: input.reason,
    });
    return { ok: true };
  }

  /** The vote ledger for a stage: who voted, for what, and whether it counts. */
  async voteLedger(slug: string, stageId: string) {
    const competition = await this.requireCompetition(slug);
    const votes = await this.prisma.competitionVote.findMany({
      where: { competitionId: competition.id, stageId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { displayName: true, email: true } },
        entry: { select: { title: true } },
      },
    });
    return {
      items: votes.map((vote) => ({
        id: vote.id,
        entryId: vote.entryId,
        entryTitle: vote.entry.title,
        voter: vote.user?.displayName ?? 'Device vote',
        method: vote.method,
        counted: vote.invalidatedAt === null,
        invalidatedAt: vote.invalidatedAt?.toISOString() ?? null,
        createdAt: vote.createdAt.toISOString(),
      })),
    };
  }

  // --- Helpers --------------------------------------------------------------

  private canVote(scope: string, isCommitteeMember: boolean): boolean {
    if (scope === 'public') return true;
    if (scope === 'committee') return isCommitteeMember;
    return isCommitteeMember || scope === 'account';
  }

  private async requireCompetition(slug: string) {
    const competition = await this.prisma.competition.findUnique({ where: { slug } });
    if (!competition) throw new NotFoundException('Competition not found');
    return competition;
  }

  private async stageAfterChange(competitionId: string, stageId: string) {
    const stage = await this.prisma.competitionStage.findUnique({
      where: { id: stageId },
      include: { entrants: { include: { entry: { select: { id: true, title: true, curator: true } } } } },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    const tally = await tallyLoadedStage(this.prisma, stage as StageWithEntrants);
    return { ...tally, competitionId };
  }

  private async committeeRoster(competitionId: string) {
    const members = await this.prisma.competitionCommitteeMember.findMany({
      where: { competitionId },
      orderBy: { addedAt: 'asc' },
      include: { user: { select: { displayName: true, email: true } } },
    });
    const shape = (member: (typeof members)[number]) => ({
      userId: member.userId,
      displayName: member.user.displayName,
      email: member.user.email,
      role: member.role,
      addedAt: member.addedAt.toISOString(),
      removedAt: member.removedAt?.toISOString() ?? null,
      removalReason: member.removalReason,
    });
    return {
      active: members.filter((member) => !member.removedAt).map(shape),
      removed: members.filter((member) => member.removedAt).map(shape),
    };
  }

  private async audit(actorId: string, action: string, entityId: string, meta: Prisma.InputJsonObject) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity: 'Competition', entityId, meta },
    });
  }
}

/** SHA-256 of the browser's device token. The raw token never reaches the API. */
export function hashDevice(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

export { STAGE_LABELS };
export type { CompetitionStageKind };
