/**
 * Competition voting: the pure rules, shared by the API and the web app.
 *
 * A competition runs three stages — quarterfinal → semifinal → final. Each stage
 * has its own entrants and its own votes, and the top `advancing` entrants move
 * on. The final produces one winner.
 *
 * Everything here is a pure function over plain data so the API's tally and the
 * page that displays it can never disagree, and so the rules can be tested
 * without a database. The database assembly lives in
 * `apps/api/src/modules/competitions/competition-tally.ts`.
 */

export const COMPETITION_STAGE_KINDS = ['quarterfinal', 'semifinal', 'final'] as const;
export type CompetitionStageKind = (typeof COMPETITION_STAGE_KINDS)[number];

export const COMPETITION_STAGE_STATUSES = ['pending', 'voting_open', 'voting_closed', 'completed'] as const;
export type CompetitionStageStatus = (typeof COMPETITION_STAGE_STATUSES)[number];

export const COMPETITION_STATUSES = ['draft', 'published', 'voting_open', 'voting_closed', 'results_published'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const COMPETITION_VOTER_SCOPES = ['public', 'account', 'committee'] as const;
export type CompetitionVoterScope = (typeof COMPETITION_VOTER_SCOPES)[number];

/** Human labels, so the API and the UI name a stage the same way. */
export const STAGE_LABELS: Record<CompetitionStageKind, string> = {
  quarterfinal: 'Quarterfinal',
  semifinal: 'Semifinal',
  final: 'Final',
};

/** One entrant's standing in one stage. */
export interface StageStanding {
  entryId: string;
  title: string;
  curator: string;
  /** Valid (not invalidated) votes for this entry in this stage. */
  votes: number;
  /** 1-based rank. Entries on equal votes share a rank. */
  rank: number;
  /** True when this entry is inside the stage's advancing cut. */
  advancing: boolean;
  /** True when the entry sits on the cut line with the same votes as the entry below it. */
  tiedAtCutoff: boolean;
}

export interface StageTally {
  stageId: string;
  kind: CompetitionStageKind;
  order: number;
  title: string;
  status: CompetitionStageStatus;
  /** How many entrants move on; 0 for the final, which produces a winner. */
  advancing: number;
  /** Total valid votes cast in this stage. */
  totalVotes: number;
  /** Entrants ranked highest first. */
  standings: StageStanding[];
  /** The entry that won the stage, or null while it is undecided. */
  winnerEntryId: string | null;
  /** True when the top two cannot be separated — a human must decide. */
  tiebreakRequired: boolean;
  /** True when a tie sits on the advancing cut line and no decision is recorded. */
  tiedAtCutoff: boolean;
  /** The organiser's recorded decision on the cut-line tie, if any. */
  tiebreakEntryId: string | null;
}

export interface StageInput {
  stageId: string;
  kind: CompetitionStageKind;
  order: number;
  title: string;
  status: CompetitionStageStatus;
  advancing: number;
  entrants: { entryId: string; title: string; curator: string }[];
  /** Valid vote counts per entry id. Missing entries count as zero. */
  votes: Record<string, number>;
  /**
   * An organiser's decision on a tie across the cut line. When set, that entry
   * takes the last advancing place and the tie is no longer reported as
   * blocking — the decision is recorded, not hidden.
   */
  tiebreakEntryId?: string | null;
}

/**
 * Rank one stage.
 *
 * Ties are never broken automatically: entries on equal votes share a rank, and
 * a tie that straddles the cut line is reported so an organiser can decide.
 * Sorting is stable on (votes desc, title asc) so the display order is the same
 * on every request.
 */
export function tallyStage(input: StageInput): StageTally {
  const rows = input.entrants
    .map((entrant) => ({
      ...entrant,
      votes: input.votes[entrant.entryId] ?? 0,
    }))
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title));

  // Competition ranking: equal votes share a rank (1, 2, 2, 4).
  let rank = 0;
  let previousVotes: number | null = null;
  const standings: StageStanding[] = rows.map((row, index) => {
    if (previousVotes === null || row.votes !== previousVotes) rank = index + 1;
    previousVotes = row.votes;
    return {
      entryId: row.entryId,
      title: row.title,
      curator: row.curator,
      votes: row.votes,
      rank,
      advancing: false,
      tiedAtCutoff: false,
    };
  });

  const cut = input.advancing;
  const rawTie =
    cut > 0 && standings.length > cut && standings[cut - 1].votes === standings[cut].votes;

  // A recorded tiebreak resolves the cut: the chosen entry advances and the
  // others on the same votes do not, even though they share a rank.
  const tiebreakEntryId = rawTie ? input.tiebreakEntryId ?? null : null;
  const tiedAtCutoff = rawTie && !tiebreakEntryId;

  for (const standing of standings) {
    standing.advancing = cut > 0 && standing.rank <= cut;
    standing.tiedAtCutoff = tiedAtCutoff && standing.rank === cut;
  }

  if (tiebreakEntryId) {
    for (const standing of standings) {
      if (standing.rank === cut) standing.advancing = standing.entryId === tiebreakEntryId;
    }
  }

  const top = standings[0];
  const tiebreakRequired =
    standings.length > 1 && standings[0].votes === standings[1].votes;

  return {
    stageId: input.stageId,
    kind: input.kind,
    order: input.order,
    title: input.title,
    status: input.status,
    advancing: cut,
    totalVotes: standings.reduce((total, standing) => total + standing.votes, 0),
    standings,
    // A stage has a winner once it is closed or completed and the top is not tied.
    winnerEntryId:
      (input.status === 'voting_closed' || input.status === 'completed') && !tiebreakRequired
        ? top?.entryId ?? null
        : null,
    tiebreakRequired,
    tiedAtCutoff,
    tiebreakEntryId,
  };
}

/**
 * The entrants that move on from a stage, in rank order.
 *
 * Returns an empty list when the stage is tied across its cut line: advancing
 * an arbitrary half of a tie is exactly the decision the rules reserve for a
 * human, so the caller must resolve it first.
 */
export function advancingEntries(tally: StageTally): string[] {
  if (tally.advancing <= 0 || tally.tiedAtCutoff) return [];
  return tally.standings.filter((standing) => standing.advancing).map((standing) => standing.entryId);
}

/** The overall winner: the final stage's winner, once it has one. */
export function competitionWinner(tallies: StageTally[]): string | null {
  const final = tallies.find((tally) => tally.kind === 'final');
  return final?.winnerEntryId ?? null;
}

/**
 * Whether a stage can be opened.
 *
 * The first stage can open as soon as it has entrants. Every later stage needs
 * the previous one closed with a decided cut, and its entrants are the previous
 * stage's advancers — so a semifinal can never be opened on a half-counted
 * quarterfinal.
 */
export function canOpenStage(
  stage: { order: number; entrants: number },
  previous: StageTally | null,
): { ok: true } | { ok: false; reason: string } {
  if (stage.entrants < 2) {
    return { ok: false, reason: 'A stage needs at least two entrants before voting can open.' };
  }
  if (stage.order === 1) return { ok: true };
  if (!previous) return { ok: false, reason: 'The previous stage does not exist.' };
  if (previous.status !== 'voting_closed' && previous.status !== 'completed') {
    return { ok: false, reason: `Close the ${STAGE_LABELS[previous.kind].toLowerCase()} before opening this stage.` };
  }
  if (previous.tiedAtCutoff) {
    return {
      ok: false,
      reason: `The ${STAGE_LABELS[previous.kind].toLowerCase()} is tied across its cut line. Resolve the tie first.`,
    };
  }
  return { ok: true };
}

/**
 * Whether a stage can be closed.
 *
 * A stage with no votes at all is not closed by accident: closing it would
 * advance whoever happened to be listed first.
 */
export function canCloseStage(tally: StageTally): { ok: true } | { ok: false; reason: string } {
  if (tally.status !== 'voting_open') {
    return { ok: false, reason: 'Only a stage that is open for voting can be closed.' };
  }
  if (tally.totalVotes === 0) {
    return { ok: false, reason: 'No votes have been cast in this stage yet.' };
  }
  return { ok: true };
}

/**
 * The device rule, as a pure decision.
 *
 * Live, a vote is bound to one device per account: the first device that votes
 * registers, and a second device is refused. Tests and seeded data may cast
 * votes without a device token, which is why `deviceHash` is optional — the
 * rule only applies when a device is actually presented.
 */
export function deviceVoteDecision(input: {
  enforceDevice: boolean;
  presentedDeviceHash: string | null;
  registeredDeviceHash: string | null;
}): { ok: true; registerDevice: boolean } | { ok: false; reason: string } {
  if (!input.enforceDevice || !input.presentedDeviceHash) {
    return { ok: true, registerDevice: false };
  }
  if (!input.registeredDeviceHash) {
    return { ok: true, registerDevice: true };
  }
  if (input.registeredDeviceHash !== input.presentedDeviceHash) {
    return {
      ok: false,
      reason: 'This account has already voted from another device. Contact the organiser if you need help.',
    };
  }
  return { ok: true, registerDevice: false };
}
