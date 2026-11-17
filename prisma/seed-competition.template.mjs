// TEMPLATE — copy this file to create a competition seed of your own.
//
//   Copy-Item prisma/seed-competition.template.mjs prisma/seed-my-cup.mjs
//   # edit the CONFIG block below
//   node prisma/seed-my-cup.mjs
//
// Everything you normally need to change is in the CONFIG block. The rest is
// the machinery that turns it into rows, and it is the same machinery
// `seed-competition.mjs` uses, so a competition seeded from here behaves
// exactly like the demo one.
//
// The seed is idempotent: it deletes and recreates the competition with the
// same slug, so you can re-run it after editing the numbers.
//
// Fictional playlists and curators only — do not commit real copyrighted
// material to the repository.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

const prisma = new PrismaClient();

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  /** URL slug. Re-running the seed replaces the competition with this slug. */
  slug: 'my-playlist-cup-2026',

  title: 'My Playlist Cup 2026',
  description: 'Eight playlists, three rounds, one winner.',
  organizer: 'Drill Lyrics KE',

  /**
   * Who may vote.
   *   'public'    — anyone, one vote per device
   *   'account'   — signed-in accounts, one vote per account
   *   'committee' — appointed committee members only
   */
  voterScope: 'public',

  /** Whether a voter may change their pick while a stage is open. */
  allowVoteChange: false,

  /**
   * The final status. Use 'results_published' for a finished competition,
   * 'voting_open' to leave the last stage open, or 'draft' to keep it hidden
   * from the public list.
   */
  status: 'results_published',

  startsAt: '2026-09-01T09:00:00+03:00',
  endsAt: '2026-10-30T21:00:00+03:00',

  /**
   * The playlists. `slug` must be unique within the competition; it is used to
   * reference the entry from the stage vote counts below.
   */
  entries: [
    { slug: 'eastlands-heat', title: 'Eastlands Heat', curator: 'DJ Mwash' },
    { slug: 'sheng-sessions', title: 'Sheng Sessions', curator: 'Ciku W.' },
    { slug: 'kilimani-nights', title: 'Kilimani Nights', curator: 'DJ Kevo' },
    { slug: 'ghetto-anthems', title: 'Ghetto Anthems', curator: 'Brian O.' },
    { slug: 'matatu-speakers', title: 'Matatu Speakers', curator: 'Njeri K.' },
    { slug: 'drill-diaries', title: 'Drill Diaries', curator: 'Otieno M.' },
    { slug: 'nairobi-north', title: 'Nairobi North', curator: 'DJ Sly' },
    { slug: 'late-night-bars', title: 'Late Night Bars', curator: 'Amina H.' },
  ],

  /**
   * The three stages, in order.
   *
   *   advancing — how many entrants move on. 0 for the final, which produces
   *               the winner instead.
   *   entrants  — which entries are in this stage. Omit on the first stage to
   *               use every entry. On later stages, list the advancers.
   *   votes     — votes per entry slug. The seed creates that many distinct
   *               voters, so the numbers are the final tally.
   *
   * The seed writes the stages as already closed. To test the live flow
   * (open → vote → close) use `scripts/smoke-competition.mjs` instead.
   */
  stages: [
    {
      kind: 'quarterfinal',
      title: 'Quarterfinal',
      advancing: 4,
      opensAt: '2026-09-05T09:00:00+03:00',
      closesAt: '2026-09-12T21:00:00+03:00',
      votes: {
        'eastlands-heat': 42,
        'sheng-sessions': 38,
        'kilimani-nights': 31,
        'ghetto-anthems': 27,
        'matatu-speakers': 19,
        'drill-diaries': 14,
        'nairobi-north': 9,
        'late-night-bars': 5,
      },
    },
    {
      kind: 'semifinal',
      title: 'Semifinal',
      advancing: 2,
      opensAt: '2026-09-15T09:00:00+03:00',
      closesAt: '2026-09-22T21:00:00+03:00',
      entrants: ['eastlands-heat', 'sheng-sessions', 'kilimani-nights', 'ghetto-anthems'],
      votes: {
        'eastlands-heat': 55,
        'sheng-sessions': 54,
        'kilimani-nights': 40,
        'ghetto-anthems': 33,
      },
    },
    {
      kind: 'final',
      title: 'Final',
      advancing: 0,
      opensAt: '2026-09-25T09:00:00+03:00',
      closesAt: '2026-10-02T21:00:00+03:00',
      entrants: ['eastlands-heat', 'sheng-sessions'],
      votes: { 'eastlands-heat': 61, 'sheng-sessions': 62 },
    },
  ],

  /**
   * Committee members, appointed by the admin. Each must be an account; the
   * seed creates one if the email does not exist yet, using the same password
   * as the admin (SEED_ADMIN_PASSWORD).
   *
   * `removed: true` seeds a member who was removed — useful for checking that
   * the removal trail renders.
   */
  committee: [
    { email: 'chair@drillke.local', displayName: 'Committee Chair', role: 'chair' },
    { email: 'judge.one@drillke.local', displayName: 'Judge One', role: 'member' },
    { email: 'judge.two@drillke.local', displayName: 'Judge Two', role: 'member' },
    { email: 'judge.three@drillke.local', displayName: 'Judge Three', role: 'member', removed: true },
  ],
};

// ─── MACHINERY (usually no need to edit below this line) ─────────────────────

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) return reject(error);
      resolve(`scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`);
    });
  });
}

function validate(config) {
  const problems = [];
  const slugs = new Set(config.entries.map((entry) => entry.slug));
  if (slugs.size !== config.entries.length) problems.push('entry slugs must be unique');

  if (config.stages.length !== 3) problems.push('a competition has exactly three stages');
  const kinds = config.stages.map((stage) => stage.kind).join(',');
  if (kinds !== 'quarterfinal,semifinal,final') {
    problems.push('stages must be quarterfinal, semifinal, final in that order');
  }

  for (const stage of config.stages) {
    const entrants = stage.entrants ?? config.entries.map((entry) => entry.slug);
    for (const slug of entrants) {
      if (!slugs.has(slug)) problems.push(`${stage.kind}: unknown entrant "${slug}"`);
    }
    for (const slug of Object.keys(stage.votes)) {
      if (!entrants.includes(slug)) problems.push(`${stage.kind}: votes for "${slug}", which is not an entrant`);
    }
    if (stage.advancing > entrants.length) {
      problems.push(`${stage.kind}: advancing ${stage.advancing} of ${entrants.length} entrants`);
    }
  }

  if (problems.length) {
    throw new Error(`Invalid competition config:\n  - ${problems.join('\n  - ')}`);
  }
}

async function main() {
  validate(CONFIG);

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be configured with at least 10 characters.');
  }
  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local' },
    update: {},
    create: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local',
      displayName: 'DrillKe Admin',
      role: 'admin',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const committeeUsers = [];
  for (const person of CONFIG.committee) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { displayName: person.displayName },
      create: {
        email: person.email,
        displayName: person.displayName,
        role: 'member',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    committeeUsers.push({ ...person, user });
  }

  await prisma.competition.deleteMany({ where: { slug: CONFIG.slug } });

  const competition = await prisma.competition.create({
    data: {
      slug: CONFIG.slug,
      title: CONFIG.title,
      description: CONFIG.description,
      organizer: CONFIG.organizer,
      status: CONFIG.status,
      voterScope: CONFIG.voterScope,
      allowVoteChange: CONFIG.allowVoteChange,
      startsAt: new Date(CONFIG.startsAt),
      endsAt: new Date(CONFIG.endsAt),
    },
  });

  const entries = new Map();
  for (const entry of CONFIG.entries) {
    entries.set(
      entry.slug,
      await prisma.competitionEntry.create({ data: { competitionId: competition.id, ...entry } }),
    );
  }

  for (const person of committeeUsers) {
    await prisma.competitionCommitteeMember.create({
      data: {
        competitionId: competition.id,
        userId: person.user.id,
        role: person.role,
        addedById: admin.id,
        ...(person.removed
          ? {
            removedAt: new Date(),
            removedById: admin.id,
            removalReason: 'Seeded as removed.',
          }
          : {}),
      },
    });
  }

  let totalVotes = 0;
  for (const [index, stage] of CONFIG.stages.entries()) {
    const entrantSlugs = stage.entrants ?? CONFIG.entries.map((entry) => entry.slug);
    const row = await prisma.competitionStage.create({
      data: {
        competitionId: competition.id,
        kind: stage.kind,
        order: index + 1,
        title: stage.title,
        status: 'completed',
        advancing: stage.advancing,
        opensAt: new Date(stage.opensAt),
        closesAt: new Date(stage.closesAt),
        entrants: {
          create: entrantSlugs.map((slug, position) => ({ entryId: entries.get(slug).id, position })),
        },
      },
    });

    for (const [entrySlug, count] of Object.entries(stage.votes)) {
      const data = Array.from({ length: count }, (_, voteIndex) => ({
        competitionId: competition.id,
        stageId: row.id,
        entryId: entries.get(entrySlug).id,
        voterKey: `seed:${stage.kind}:${entrySlug}:${voteIndex}`,
        method: 'device',
      }));
      await prisma.competitionVote.createMany({ data });
      totalVotes += data.length;
    }
  }

  const final = CONFIG.stages[2];
  const winnerSlug = Object.entries(final.votes).sort((a, b) => b[1] - a[1])[0]?.[0];

  console.log('Seeded competition:', {
    slug: CONFIG.slug,
    stages: CONFIG.stages.map((stage) => `${stage.title} (${Object.values(stage.votes).reduce((a, b) => a + b, 0)} votes)`),
    committee: committeeUsers.map((person) => `${person.displayName}${person.removed ? ' (removed)' : ''}`),
    totalVotes,
    winner: entries.get(winnerSlug)?.title ?? '(none)',
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
