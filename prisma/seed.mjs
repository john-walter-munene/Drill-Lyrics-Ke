// Seed data for local development.
//
// Fictional artists, songs, DJs, podcasts and events only. Do not commit real
// copyrighted lyrics to the repository.
//
//   npm run db:seed
//
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Placeholder video — never a real copyrighted song. */
const PLACEHOLDER_VIDEO_ID = 'dQw4w9WgXcQ';

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'admin' },
    create: {
      email: adminEmail,
      displayName: 'DrillKe Admin',
      role: 'admin',
      // Password hashing is wired up with the auth module (Phase 1).
      passwordHash: null,
    },
  });

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

  const song = await prisma.song.upsert({
    where: { slug: 'example-artist-example-track' },
    update: {},
    create: {
      slug: 'example-artist-example-track',
      title: 'Example Track',
      youtubeVideoId: PLACEHOLDER_VIDEO_ID,
      language: 'sheng',
      status: 'published',
      releaseDate: new Date('2026-03-14'),
      artists: { create: [{ artistId: artist.id, isPrimary: true, position: 0 }] },
    },
  });

  // A synchronized version with placeholder lines — shows the player's shape
  // without shipping anyone's real lyrics.
  const existingVersion = await prisma.lyricVersion.findFirst({
    where: { songId: song.id },
  });
  if (!existingVersion) {
    await prisma.lyricVersion.create({
      data: {
        songId: song.id,
        version: 1,
        syncStatus: 'synchronized',
        source: 'seed',
        published: true,
        publishedAt: new Date(),
        lines: {
          create: [
            { index: 0, startMs: 12_500, text: 'First placeholder line.' },
            { index: 1, startMs: 15_200, text: 'Second placeholder line.' },
            { index: 2, startMs: 18_100, text: 'Third placeholder line.' },
          ],
        },
        annotations: {
          create: [
            {
              phrase: 'placeholder',
              explanation: 'Seed data — replace with a real Sheng/slang annotation.',
              lineIndex: 0,
            },
          ],
        },
      },
    });
  }

  const dj = await prisma.dj.upsert({
    where: { slug: 'example-dj' },
    update: {},
    create: {
      slug: 'example-dj',
      name: 'Example DJ',
      bio: 'Placeholder DJ used by the local seed.',
      city: 'Nairobi',
      links: { create: [{ label: 'Mixcloud', url: 'https://www.mixcloud.com/example' }] },
      tracks: { create: [{ songId: song.id, rank: 1 }] },
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
            songs: { create: [{ songId: song.id }] },
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
    song: song.slug,
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
