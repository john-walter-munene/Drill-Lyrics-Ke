// Seed a complete three-stage playlist competition.
//
//   npm run db:seed:competition
//
// The competition is seeded *finished*: quarterfinal → semifinal → final, with
// every stage closed, a winner, and the full vote ledger behind it. That makes
// the results pages, the transparency view and the admin screens testable
// without clicking through three rounds by hand.
//
// It is idempotent: re-running replaces the seeded competition and its votes.
//
// Fictional playlists and curators only.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

const prisma = new PrismaClient();

const SLUG = 'nairobi-drill-playlist-cup-2026';

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) return reject(error);
      resolve(`scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`);
    });
  });
}

/** Eight playlists enter the quarterfinal. */
const ENTRIES = [
  { slug: 'eastlands-heat', title: 'Eastlands Heat', curator: 'DJ Mwash' },
  { slug: 'sheng-sessions', title: 'Sheng Sessions', curator: 'Ciku W.' },
  { slug: 'kilimani-nights', title: 'Kilimani Nights', curator: 'DJ Kevo' },
  { slug: 'ghetto-anthems', title: 'Ghetto Anthems', curator: 'Brian O.' },
  { slug: 'matatu-speakers', title: 'Matatu Speakers', curator: 'Njeri K.' },
  { slug: 'drill-diaries', title: 'Drill Diaries', curator: 'Otieno M.' },
  { slug: 'nairobi-north', title: 'Nairobi North', curator: 'DJ Sly' },
  { slug: 'late-night-bars', title: 'Late Night Bars', curator: 'Amina H.' },
];

/**
 * Votes per stage, keyed by entry slug. The numbers are chosen so the bracket
 * is interesting: a clear quarterfinal, a close semifinal, and a final decided
 * by a single vote.
 */
const STAGES = [
  {
    kind: 'quarterfinal',
    order: 1,
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
    order: 2,
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
    order: 3,
    title: 'Final',
    advancing: 0,
    opensAt: '2026-09-25T09:00:00+03:00',
    closesAt: '2026-10-02T21:00:00+03:00',
    entrants: ['eastlands-heat', 'sheng-sessions'],
    votes: { 'eastlands-heat': 61, 'sheng-sessions': 62 },
  },
];

const COMMITTEE = [
  { email: 'chair@drillke.local', displayName: 'Committee Chair', role: 'chair' },
  { email: 'judge.one@drillke.local', displayName: 'Judge One', role: 'member' },
  { email: 'judge.two@drillke.local', displayName: 'Judge Two', role: 'member' },
  // Removed after the quarterfinal: proves the soft delete keeps the trail.
  { email: 'judge.three@drillke.local', displayName: 'Judge Three', role: 'member', removed: true },
];

async function main() {
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

  // Committee accounts. They are ordinary members: the committee is a
  // per-competition appointment, not a site role.
  const committeeUsers = [];
  for (const person of COMMITTEE) {
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

  // Replace any previous run of this competition.
  await prisma.competition.deleteMany({ where: { slug: SLUG } });

  const competition = await prisma.competition.create({
    data: {
      slug: SLUG,
      title: 'Nairobi Drill Playlist Cup 2026',
      description:
        'Eight community playlists, three rounds, one winner. Every stage is published with its full vote count so the path to the title can be checked.',
      organizer: 'Drill Lyrics KE',
      status: 'results_published',
      voterScope: 'public',
      allowVoteChange: false,
      startsAt: new Date('2026-09-01T09:00:00+03:00'),
      endsAt: new Date('2026-10-30T21:00:00+03:00'),
    },
  });

  const entries = new Map();
  for (const entry of ENTRIES) {
    const row = await prisma.competitionEntry.create({
      data: { competitionId: competition.id, ...entry },
    });
    entries.set(entry.slug, row);
  }

  // Committee: three active members, one removed after the quarterfinal.
  for (const person of committeeUsers) {
    await prisma.competitionCommitteeMember.create({
      data: {
        competitionId: competition.id,
        userId: person.user.id,
        role: person.role,
        addedById: admin.id,
        ...(person.removed
          ? {
            removedAt: new Date('2026-09-20T12:00:00+03:00'),
            removedById: admin.id,
            removalReason: 'Stepped down after the quarterfinal.',
          }
          : {}),
      },
    });
  }

  const stageRows = [];
  for (const stage of STAGES) {
    const entrants = stage.entrants ?? ENTRIES.map((entry) => entry.slug);
    const row = await prisma.competitionStage.create({
      data: {
        competitionId: competition.id,
        kind: stage.kind,
        order: stage.order,
        title: stage.title,
        status: 'completed',
        advancing: stage.advancing,
        opensAt: new Date(stage.opensAt),
        closesAt: new Date(stage.closesAt),
        entrants: {
          create: entrants.map((slug, position) => ({ entryId: entries.get(slug).id, position })),
        },
      },
    });
    stageRows.push({ ...stage, row });
  }

  // Votes. Each vote is a distinct voter key so the (stage, voterKey) unique
  // index holds. Seeded votes carry no device hash: the device rule is a live
  // constraint, and the seed must be able to produce a full bracket.
  let voteCount = 0;
  for (const stage of stageRows) {
    for (const [entrySlug, count] of Object.entries(stage.votes)) {
      const entry = entries.get(entrySlug);
      const data = Array.from({ length: count }, (_, index) => ({
        competitionId: competition.id,
        stageId: stage.row.id,
        entryId: entry.id,
        voterKey: `seed:${stage.kind}:${entrySlug}:${index}`,
        method: 'device',
      }));
      await prisma.competitionVote.createMany({ data });
      voteCount += data.length;
    }
  }

  const winner = entries.get('sheng-sessions');
  console.log('Seeded competition:', {
    slug: competition.slug,
    stages: stageRows.map((stage) => `${stage.title} (${Object.values(stage.votes).reduce((a, b) => a + b, 0)} votes)`),
    committee: committeeUsers.map((person) => `${person.displayName}${person.removed ? ' (removed)' : ''}`),
    totalVotes: voteCount,
    winner: winner.title,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
