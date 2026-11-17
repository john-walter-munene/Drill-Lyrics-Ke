import type { PrismaClient } from '@prisma/client';
import {
  tallyStage,
  type CompetitionStageKind,
  type CompetitionStageStatus,
  type StageTally,
} from '@drillke/shared';

/**
 * Assembles the stage tallies from the database and hands them to the pure
 * rules in `@drillke/shared/competition`.
 *
 * The split matters: the ranking, the tie flags and the winner are decided by
 * one tested function, and this file only decides *which rows* feed it. The
 * public results page and the admin view call the same function, so a number
 * shown to a voter is the number the organiser sees.
 *
 * Invalidated votes are excluded everywhere. They are kept in the table so the
 * record of what happened is complete, but they never count.
 */

type Db = Pick<PrismaClient, 'competitionStage' | 'competitionVote'>;

export interface StageWithEntrants {
  id: string;
  kind: CompetitionStageKind;
  order: number;
  title: string;
  status: CompetitionStageStatus;
  advancing: number;
  tiebreakEntryId: string | null;
  entrants: {
    entry: { id: string; title: string; curator: string };
  }[];
}

/** Vote counts per entry for one stage, invalidated votes excluded. */
export async function voteCounts(db: Db, stageId: string): Promise<Record<string, number>> {
  const groups = await db.competitionVote.groupBy({
    by: ['entryId'],
    where: { stageId, invalidatedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((group) => [group.entryId, group._count._all]));
}

/** Tally one stage that has already been loaded with its entrants. */
export async function tallyLoadedStage(db: Db, stage: StageWithEntrants): Promise<StageTally> {
  return tallyStage({
    stageId: stage.id,
    kind: stage.kind,
    order: stage.order,
    title: stage.title,
    status: stage.status,
    advancing: stage.advancing,
    entrants: stage.entrants.map(({ entry }) => ({
      entryId: entry.id,
      title: entry.title,
      curator: entry.curator,
    })),
    votes: await voteCounts(db, stage.id),
    tiebreakEntryId: stage.tiebreakEntryId,
  });
}

/** Tally every stage of a competition, in stage order. */
export async function tallyCompetition(db: Db, competitionId: string): Promise<StageTally[]> {
  const stages = await db.competitionStage.findMany({
    where: { competitionId },
    orderBy: { order: 'asc' },
    include: { entrants: { include: { entry: { select: { id: true, title: true, curator: true } } } } },
  });
  const tallies: StageTally[] = [];
  for (const stage of stages) {
    tallies.push(await tallyLoadedStage(db, stage as StageWithEntrants));
  }
  return tallies;
}

/**
 * The device a voter has already used in this competition, if any.
 *
 * The live rule is one device per account per competition: the first device
 * that votes registers, and a later vote from a different device is refused.
 * Votes cast without a device (seeded data, tests) do not register one.
 */
export async function registeredDeviceHash(
  db: Db,
  competitionId: string,
  userId: string,
): Promise<string | null> {
  const vote = await db.competitionVote.findFirst({
    where: { competitionId, userId, deviceHash: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { deviceHash: true },
  });
  return vote?.deviceHash ?? null;
}
