// Seed data for local development.
//
// Fictional artists, songs, DJs, podcasts and events only. Do not commit real
// copyrighted lyrics to the repository.
//
//   npm run db:seed
//
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

const prisma = new PrismaClient();

/** Placeholder video — never a real copyrighted song. */
const PLACEHOLDER_VIDEO_ID = 'dQw4w9WgXcQ';

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) return reject(error);
      resolve(`scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`);
    });
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const resetAdminPassword = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';
  if (!adminPassword || adminPassword.length < 10) {
    // The entrypoint treats a failed seed as "skip and continue" (the app still
    // runs without seed content), so this is the ONLY place a missing admin
    // password can be reported. Without the hint below the symptom is an admin
    // account that quietly does not exist, i.e. "admin login does not work".
    throw new Error(
      'SEED_ADMIN_PASSWORD must be configured with at least 10 characters — ' +
      'set it in infra/.env (or the host .env.local) and restart the API. ' +
      'Until then NO admin account is created.',
    );
  }
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  // Promote a matching non-staff account: an admin who signed up through the
  // normal form (and so got `member`) otherwise has no way to reach /admin until
  // somebody else promotes them — and on a fresh install there is nobody.
  const adminRole = existingAdmin && existingAdmin.role !== 'admin' ? { role: 'admin' } : {};
  const admin = existingAdmin
    ? (existingAdmin.passwordHash && !resetAdminPassword && !adminRole.role ? existingAdmin : await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { ...adminRole, ...(resetAdminPassword || !existingAdmin.passwordHash ? { passwordHash: await hashPassword(adminPassword) } : {}) },
    }))
    : await prisma.user.create({ data: {
      email: adminEmail,
      displayName: 'DrillKe Admin',
      role: 'admin',
      passwordHash: await hashPassword(adminPassword),
      // Seeded staff are confirmed by definition: the operator running the seed
      // already controls the address, and an admin who cannot confirm because
      // MAIL_PROVIDER=mock would be permanently unverified.
      emailVerifiedAt: new Date(),
    } });

  const artist = await prisma.artist.upsert({
    where: { slug: 'example-artist' },
    update: {},
    create: {
      slug: 'example-artist',
      name: 'Example Artist',
      bio: 'Placeholder artist used by the local seed. Replace with real, licensed data.',
      links: {
        create: [
          { label: 'YouTube', url: 'https://www.youtube.com/@example' },
          { label: 'Instagram', url: 'https://www.instagram.com/example' },
        ],
      },
    },
  });

  // First user-supplied player test video. The title is copied from its public
  // YouTube player; leave the artist relationship empty until it's confirmed.
  const playerTestSong = await prisma.song.upsert({
    where: { slug: 'player-test-npvw1ntged4' },
    update: { title: 'NastyGoat- Strap (music video)' },
    create: {
      slug: 'player-test-npvw1ntged4',
      title: 'NastyGoat- Strap (music video)',
      youtubeVideoId: 'nPVW1ntGeD4',
      language: 'mixed',
      status: 'published',
    },
  });

  // User-supplied queue tracks for testing Listen/Watch and previous/next.
  // Titles are from YouTube's public oEmbed metadata; artist profiles are left
  // unassigned until the catalogue relationship is confirmed.
  const playbackTestVideos = [
    {
      slug: 'masicka-update-official-video',
      title: 'Masicka - Update (Official Video)',
      youtubeVideoId: 'bNjQUtXiX8o',
    },
    {
      slug: 'wakadinali-top-scorer-official-audio',
      title: 'Wakadinali-"Top Scorer"(Official Audio)',
      youtubeVideoId: 'ZRK-hDiks50',
    },
    {
      slug: 'wakadinali-blow-deluxe-official-music-video',
      title: 'Wakadinali - "Blow" Deluxe (Official Music Video)',
      youtubeVideoId: 'wEZZQIlXXrY',
    },
    {
      slug: 'natty-no-lotion-visualiser',
      title: 'NATTY - NO LOTION (VISUALISER)',
      youtubeVideoId: 'yXQYjHE8z1U',
    },
  ];

  const playbackTestSongs = await Promise.all(playbackTestVideos.map((video) =>
    prisma.song.upsert({
      where: { slug: video.slug },
      update: {
        title: video.title,
        youtubeVideoId: video.youtubeVideoId,
        language: 'mixed',
        status: 'published',
      },
      create: {
        ...video,
        language: 'mixed',
        status: 'published',
      },
    }),
  ));

  const dj = await prisma.dj.upsert({
    where: { slug: 'example-dj' },
    update: {},
    create: {
      slug: 'example-dj',
      name: 'Example DJ',
      bio: 'Placeholder DJ used by the local seed.',
      city: 'Nairobi',
      links: { create: [{ label: 'Mixcloud', url: 'https://www.mixcloud.com/example' }] },
    },
  });

  const podcast = await prisma.podcast.upsert({
    where: { slug: 'example-podcast' },
    update: {},
    create: {
      slug: 'example-podcast',
      title: 'Example Drill Podcast',
      description: 'Placeholder podcast covering the Kenyan drill scene.',
      hostName: 'Example Host',
      episodes: {
        create: [
          {
            number: 1,
            title: 'Episode 1 — Placeholder',
            publishedAt: new Date('2026-03-20'),
            externalUrl: `https://www.youtube.com/watch?v=${PLACEHOLDER_VIDEO_ID}`,
            platform: 'youtube',
            artists: { create: [{ artistId: artist.id }] },
          },
        ],
      },
    },
  });

  const event = await prisma.event.upsert({
    where: { slug: 'example-drill-night' },
    update: {},
    create: {
      slug: 'example-drill-night',
      title: 'Example Drill Night',
      description: 'Placeholder event used by the local seed.',
      venue: 'Example Venue',
      city: 'Nairobi',
      startsAt: new Date('2026-11-14T20:00:00+03:00'),
      ticketUrl: 'https://example.com/tickets',
      ticketPrice: 'KES 1,000',
      artists: { create: [{ artistId: artist.id }] },
      djs: { create: [{ djId: dj.id }] },
    },
  });

  console.log('Seeded:', {
    admin: admin.email,
    artist: artist.slug,
    playerTestSong: playerTestSong.slug,
    playbackTestSongs: playbackTestSongs.map((song) => song.slug),
    dj: dj.slug,
    podcast: podcast.slug,
    event: event.slug,
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
