import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advancingEntries,
  canCloseStage,
  canOpenStage,
  competitionWinner,
  deviceVoteDecision,
  tallyStage,
  type StageInput,
} from '../../../../packages/shared/src/competition.ts';

/**
 * The three-stage voting rules. These are the numbers an organiser publishes, so
 * the tests pin the behaviour that matters: ranking, ties, the cut, and the
 * order in which stages may open and close.
 */

function stage(overrides: Partial<StageInput> = {}): StageInput {
  return {
    stageId: 's1',
    kind: 'quarterfinal',
    order: 1,
    title: 'Quarterfinal',
    status: 'voting_open',
    advancing: 2,
    entrants: [
      { entryId: 'a', title: 'Alpha', curator: 'Ann' },
      { entryId: 'b', title: 'Bravo', curator: 'Ben' },
      { entryId: 'c', title: 'Charlie', curator: 'Cara' },
    ],
    votes: { a: 10, b: 6, c: 2 },
    ...overrides,
  };
}

test('ranks entrants by votes, highest first', () => {
  const tally = tallyStage(stage());
  assert.deepEqual(tally.standings.map((s) => s.entryId), ['a', 'b', 'c']);
  assert.deepEqual(tally.standings.map((s) => s.rank), [1, 2, 3]);
  assert.equal(tally.totalVotes, 18);
});

test('marks the top `advancing` entrants and nothing else', () => {
  const tally = tallyStage(stage());
  assert.deepEqual(advancingEntries(tally), ['a', 'b']);
  assert.equal(tally.standings[2].advancing, false);
});

test('an entrant with no votes still appears, ranked last', () => {
  const tally = tallyStage(stage({ votes: { a: 3 } }));
  assert.equal(tally.standings.length, 3);
  assert.equal(tally.standings[2].votes, 0);
});

test('equal votes share a rank (1, 2, 2, 4)', () => {
  const tally = tallyStage(
    stage({
      advancing: 1,
      entrants: [
        { entryId: 'a', title: 'Alpha', curator: 'Ann' },
        { entryId: 'b', title: 'Bravo', curator: 'Ben' },
        { entryId: 'c', title: 'Charlie', curator: 'Cara' },
        { entryId: 'd', title: 'Delta', curator: 'Dan' },
      ],
      votes: { a: 9, b: 5, c: 5, d: 1 },
    }),
  );
  assert.deepEqual(tally.standings.map((s) => s.rank), [1, 2, 2, 4]);
});

test('a tie across the cut line is flagged and advances nobody', () => {
  const tally = tallyStage(stage({ advancing: 1, votes: { a: 5, b: 5, c: 1 } }));
  assert.equal(tally.tiedAtCutoff, true);
  assert.equal(tally.tiebreakRequired, true);
  // Advancing an arbitrary half of a tie is the decision reserved for a human.
  assert.deepEqual(advancingEntries(tally), []);
});

test('a tie below the cut line does not block advancing', () => {
  const tally = tallyStage(stage({ advancing: 1, votes: { a: 9, b: 4, c: 4 } }));
  assert.equal(tally.tiedAtCutoff, false);
  assert.deepEqual(advancingEntries(tally), ['a']);
});

test('a stage has a winner only once it is closed and the top is not tied', () => {
  assert.equal(tallyStage(stage({ status: 'voting_open' })).winnerEntryId, null);
  assert.equal(tallyStage(stage({ status: 'voting_closed' })).winnerEntryId, 'a');
  assert.equal(
    tallyStage(stage({ status: 'voting_closed', votes: { a: 5, b: 5, c: 1 } })).winnerEntryId,
    null,
  );
});

test('the final produces the competition winner', () => {
  const quarterfinal = tallyStage(stage({ status: 'completed' }));
  const semifinal = tallyStage(
    stage({ stageId: 's2', kind: 'semifinal', order: 2, status: 'completed', advancing: 1 }),
  );
  const final = tallyStage(
    stage({
      stageId: 's3',
      kind: 'final',
      order: 3,
      status: 'voting_closed',
      advancing: 0,
      entrants: [
        { entryId: 'a', title: 'Alpha', curator: 'Ann' },
        { entryId: 'b', title: 'Bravo', curator: 'Ben' },
      ],
      votes: { a: 12, b: 20 },
    }),
  );
  assert.equal(competitionWinner([quarterfinal, semifinal, final]), 'b');
});

test('the first stage opens with two or more entrants', () => {
  assert.deepEqual(canOpenStage({ order: 1, entrants: 3 }, null), { ok: true });
  assert.equal(canOpenStage({ order: 1, entrants: 1 }, null).ok, false);
});

test('a later stage cannot open until the previous one is closed', () => {
  const open = tallyStage(stage({ status: 'voting_open' }));
  const closed = tallyStage(stage({ status: 'voting_closed' }));
  assert.equal(canOpenStage({ order: 2, entrants: 2 }, open).ok, false);
  assert.deepEqual(canOpenStage({ order: 2, entrants: 2 }, closed), { ok: true });
});

test('a later stage cannot open on a tie across the cut', () => {
  const tied = tallyStage(stage({ status: 'voting_closed', advancing: 1, votes: { a: 5, b: 5, c: 1 } }));
  const result = canOpenStage({ order: 2, entrants: 2 }, tied);
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.reason, /tied/i);
});

test('a stage with no votes cannot be closed', () => {
  const empty = tallyStage(stage({ votes: {} }));
  assert.equal(canCloseStage(empty).ok, false);
  assert.deepEqual(canCloseStage(tallyStage(stage())), { ok: true });
});

test('the device rule registers the first device and refuses a second', () => {
  const first = deviceVoteDecision({
    enforceDevice: true,
    presentedDeviceHash: 'hash-a',
    registeredDeviceHash: null,
  });
  assert.deepEqual(first, { ok: true, registerDevice: true });

  const same = deviceVoteDecision({
    enforceDevice: true,
    presentedDeviceHash: 'hash-a',
    registeredDeviceHash: 'hash-a',
  });
  assert.deepEqual(same, { ok: true, registerDevice: false });

  const other = deviceVoteDecision({
    enforceDevice: true,
    presentedDeviceHash: 'hash-b',
    registeredDeviceHash: 'hash-a',
  });
  assert.equal(other.ok, false);
});

test('the device rule is skipped when it is not enforced or no device is presented', () => {
  assert.deepEqual(
    deviceVoteDecision({ enforceDevice: false, presentedDeviceHash: 'x', registeredDeviceHash: 'y' }),
    { ok: true, registerDevice: false },
  );
  assert.deepEqual(
    deviceVoteDecision({ enforceDevice: true, presentedDeviceHash: null, registeredDeviceHash: 'y' }),
    { ok: true, registerDevice: false },
  );
});
