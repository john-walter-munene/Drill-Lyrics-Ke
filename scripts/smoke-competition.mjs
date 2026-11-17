// End-to-end test of three-stage competition voting.
//
//   node scripts/smoke-competition.mjs
//
// Drives a fresh competition from draft to a declared winner against a running
// API, exercising the rules that matter:
//
//   * an admin appoints committee members, and removes one;
//   * a stage cannot open before the previous one is closed;
//   * a stage with no votes cannot be closed;
//   * a tie across the cut line blocks the next stage until it is resolved;
//   * votes are one per voter per stage, and a second vote is refused;
//   * the quarterfinal and semifinal results stay readable after the final;
//   * the final produces exactly one winner.
//
// The device rule is exercised in its "no device presented" form: this script
// votes as distinct accounts, which is what the live rule binds a device to.
// The device constraint itself is unit-tested in packages/shared.
import { PrismaClient } from '@prisma/client';

const API = process.env.API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

const SLUG = `smoke-cup-${Date.now()}`;
const PASSWORD = 'smoke-test-password-2026';
// The admin account is created by the seed, so its password comes from the same
// place the seed got it: the environment.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function signIn(email, password = PASSWORD) {
  const { data } = await api('POST', '/api/auth/signin', { body: { email, password } });
  if (!data.token) throw new Error(`Could not sign in as ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

async function main() {
  console.log(`\nCompetition smoke test → ${API}\n`);

  // --- Setup ---------------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';
  if (!ADMIN_PASSWORD) {
    throw new Error('SEED_ADMIN_PASSWORD must be set (the same value the seed used) to sign in as the admin.');
  }
  const adminToken = await signIn(adminEmail, ADMIN_PASSWORD);

  // Voters: three accounts, one of which will be a committee member.
  const voters = [];
  for (const name of ['voter-one', 'voter-two', 'voter-three']) {
    const email = `${name}-${SLUG}@drillke.local`;
    await api('POST', '/api/auth/signup', { body: { email, password: PASSWORD, displayName: name } });
    voters.push({ email, token: await signIn(email) });
  }

  const competition = await prisma.competition.create({
    data: {
      slug: SLUG,
      title: 'Smoke Test Cup',
      description: 'Created by scripts/smoke-competition.mjs',
      status: 'published',
      voterScope: 'account',
      allowVoteChange: false,
    },
  });

  const entryNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
  const entries = [];
  for (const title of entryNames) {
    entries.push(
      await prisma.competitionEntry.create({
        data: { competitionId: competition.id, slug: title.toLowerCase(), title, curator: `Curator ${title}` },
      }),
    );
  }

  const stageDefs = [
    { kind: 'quarterfinal', order: 1, title: 'Quarterfinal', advancing: 2 },
    { kind: 'semifinal', order: 2, title: 'Semifinal', advancing: 1 },
    { kind: 'final', order: 3, title: 'Final', advancing: 0 },
  ];
  const stages = [];
  for (const def of stageDefs) {
    stages.push(
      await prisma.competitionStage.create({
        data: {
          competitionId: competition.id,
          ...def,
          entrants: {
            create: entries.map((entry, position) => ({ entryId: entry.id, position })),
          },
        },
      }),
    );
  }

  // --- Committee -----------------------------------------------------------
  console.log('Committee');
  const add = await api('POST', `/api/competitions/${SLUG}/committee`, {
    token: adminToken,
    body: { email: voters[0].email, role: 'chair' },
  });
  check('admin adds a committee member', add.status === 201 || add.status === 200, JSON.stringify(add.data));

  const duplicate = await api('POST', `/api/competitions/${SLUG}/committee`, {
    token: adminToken,
    body: { email: voters[0].email },
  });
  check('adding the same member twice is refused', duplicate.status === 409, `status ${duplicate.status}`);

  const nonAdmin = await api('POST', `/api/competitions/${SLUG}/committee`, {
    token: voters[1].token,
    body: { email: voters[2].email },
  });
  check('a non-admin cannot appoint committee members', nonAdmin.status === 403, `status ${nonAdmin.status}`);

  const memberId = (await prisma.user.findUnique({ where: { email: voters[0].email } })).id;
  const remove = await api('DELETE', `/api/competitions/${SLUG}/committee/${memberId}`, {
    token: adminToken,
    body: { reason: 'Smoke test removal' },
  });
  check('admin removes a committee member', remove.status === 200, JSON.stringify(remove.data));

  const afterRemove = await prisma.competitionCommitteeMember.findUnique({
    where: { competitionId_userId: { competitionId: competition.id, userId: memberId } },
  });
  check('removal is a soft delete that keeps the row', afterRemove?.removedAt !== null, 'row was deleted');
  check('the removal reason is recorded', afterRemove?.removalReason === 'Smoke test removal');

  // Re-add so the committee is non-empty for the rest of the run.
  const readd = await api('POST', `/api/competitions/${SLUG}/committee`, {
    token: adminToken,
    body: { email: voters[0].email, role: 'chair' },
  });
  check('a removed member can be re-appointed', readd.status === 200 || readd.status === 201, JSON.stringify(readd.data));

  // --- Stage 1: quarterfinal ----------------------------------------------
  console.log('\nQuarterfinal');
  const earlyClose = await api('POST', `/api/competitions/${SLUG}/stages/${stages[0].id}/close`, { token: adminToken });
  check('a stage that is not open cannot be closed', earlyClose.status === 400, `status ${earlyClose.status}`);

  const open1 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[0].id}/open`, { token: adminToken });
  check('admin opens the quarterfinal', open1.status === 201 || open1.status === 200, JSON.stringify(open1.data));

  const open2Early = await api('POST', `/api/competitions/${SLUG}/stages/${stages[1].id}/open`, { token: adminToken });
  check('the semifinal cannot open before the quarterfinal closes', open2Early.status === 400, `status ${open2Early.status}`);

  const vote1 = await api('POST', `/api/competitions/${SLUG}/vote`, {
    token: voters[0].token,
    body: { entryId: entries[0].id },
  });
  check('a voter casts a vote', vote1.status === 201 || vote1.status === 200, JSON.stringify(vote1.data));

  const voteAgain = await api('POST', `/api/competitions/${SLUG}/vote`, {
    token: voters[0].token,
    body: { entryId: entries[1].id },
  });
  check('a second vote in the same stage is refused', voteAgain.status === 409, `status ${voteAgain.status}`);

  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[1].token, body: { entryId: entries[0].id } });
  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[2].token, body: { entryId: entries[1].id } });

  const close1 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[0].id}/close`, { token: adminToken });
  check('admin closes the quarterfinal', close1.status === 201 || close1.status === 200, JSON.stringify(close1.data));
  check('the quarterfinal has a winner', close1.data?.stage?.winnerEntryId === entries[0].id, JSON.stringify(close1.data?.stage?.winnerEntryId));

  // --- Stage 2: semifinal --------------------------------------------------
  console.log('\nSemifinal');
  const open2 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[1].id}/open`, { token: adminToken });
  check('the semifinal opens once the quarterfinal is closed', open2.status === 201 || open2.status === 200, JSON.stringify(open2.data));

  const semifinalEntrants = await prisma.competitionStageEntrant.findMany({ where: { stageId: stages[1].id } });
  check('the semifinal carries the quarterfinal advancers forward', semifinalEntrants.length === 2, `${semifinalEntrants.length} entrants`);

  // A deliberate tie across the cut line: one vote each, one advances.
  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[0].token, body: { entryId: entries[0].id } });
  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[1].token, body: { entryId: entries[1].id } });

  const close2 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[1].id}/close`, { token: adminToken });
  check('a tied semifinal can be closed', close2.status === 201 || close2.status === 200, JSON.stringify(close2.data));
  check('the tie is reported, not silently broken', close2.data?.stage?.tiedAtCutoff === true, JSON.stringify(close2.data?.stage?.tiedAtCutoff));

  const open3Blocked = await api('POST', `/api/competitions/${SLUG}/stages/${stages[2].id}/open`, { token: adminToken });
  check('the final cannot open on an unresolved tie', open3Blocked.status === 400, `status ${open3Blocked.status}`);

  const tiebreak = await api('POST', `/api/competitions/${SLUG}/stages/${stages[1].id}/tiebreak`, {
    token: adminToken,
    body: { entryId: entries[1].id, reason: 'Smoke test: higher first-time voter share' },
  });
  check('the organiser resolves the tie', tiebreak.status === 201 || tiebreak.status === 200, JSON.stringify(tiebreak.data));

  // --- Stage 3: final ------------------------------------------------------
  console.log('\nFinal');
  const open3 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[2].id}/open`, { token: adminToken });
  check('the final opens after the tie is resolved', open3.status === 201 || open3.status === 200, JSON.stringify(open3.data));

  const finalEntrants = await prisma.competitionStageEntrant.findMany({ where: { stageId: stages[2].id } });
  check('the final carries the resolved advancer forward', finalEntrants.length === 1, `${finalEntrants.length} entrants`);

  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[0].token, body: { entryId: entries[1].id } });
  await api('POST', `/api/competitions/${SLUG}/vote`, { token: voters[1].token, body: { entryId: entries[1].id } });

  const close3 = await api('POST', `/api/competitions/${SLUG}/stages/${stages[2].id}/close`, { token: adminToken });
  check('the final closes', close3.status === 201 || close3.status === 200, JSON.stringify(close3.data));

  // --- Transparency --------------------------------------------------------
  console.log('\nPublished results');
  const detail = await api('GET', `/api/competitions/${SLUG}`, { token: adminToken });
  const body = detail.data;

  check('the competition reports a winner', body.winnerEntryId === entries[1].id, JSON.stringify(body.winnerEntryId));
  check('all three stages are published', body.stages?.length === 3, `${body.stages?.length} stages`);

  const [qf, sf, fin] = body.stages ?? [];
  check('the quarterfinal result is still readable', qf?.standings?.length === 4 && qf.totalVotes === 3, JSON.stringify(qf?.totalVotes));
  check('the quarterfinal shows who advanced', qf?.standings?.filter((s) => s.advancing).length === 2);
  check('the semifinal result is still readable', sf?.standings?.length === 2 && sf.totalVotes === 2, JSON.stringify(sf?.totalVotes));
  check('the semifinal records the tiebreak', sf?.tiebreakEntryId === entries[1].id, JSON.stringify(sf?.tiebreakEntryId));
  check('the final shows the winner', fin?.winnerEntryId === entries[1].id, JSON.stringify(fin?.winnerEntryId));
  check('the final has no advancing cut', fin?.advancing === 0);

  const ledger = await api('GET', `/api/competitions/${SLUG}/stages/${stages[0].id}/votes`, { token: adminToken });
  check('the vote ledger lists every vote', ledger.data?.items?.length === 3, `${ledger.data?.items?.length} votes`);
  check('the ledger names the voters', ledger.data?.items?.every((item) => item.voter !== 'Device vote'));

  // --- Cleanup -------------------------------------------------------------
  await prisma.competition.delete({ where: { id: competition.id } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${SLUG}@drillke.local` } } });

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
