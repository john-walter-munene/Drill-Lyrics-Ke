/**
 * Markdown import/export for the lyrics catalogue (`docs/lyrics-format.md` §6).
 *
 *   npm run content:export      # published songs → content/<artist>/<song>.md
 *   npm run content:import      # content/**.md → pending submissions
 *   npm run content:import -- --dry-run
 *
 * Design notes:
 *
 *   - **Export is generated, never hand-edited.** It reads the published
 *     `LyricVersion` and writes the format the parser reads back, so a round trip
 *     through Git cannot silently change a lyric.
 *   - **Import never publishes.** A changed file becomes a *pending* submission,
 *     exactly like a contribution from the site, so review stays the only path
 *     to publication (`product.md` principle 5).
 *   - **Import is idempotent by (artist, title, youtubeVideoId).** An unchanged
 *     file produces no new submission; a changed one produces a pending
 *     submission only when no pending submission for that song already exists.
 *   - The scripts talk to Postgres directly rather than through the API, so they
 *     work in CI and on a developer machine without a running server. That is
 *     the same trade the seed makes.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { msToTimestamp, parseLyricsDocument, serializeLyricsDocument } from '@drillke/shared';

const prisma = new PrismaClient();
const CONTENT_DIR = join(process.cwd(), 'content');
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

/** Filesystem-safe, stable slug for an artist or song directory name. */
function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

async function exportCatalogue() {
  const songs = await prisma.song.findMany({
    where: { status: 'published', versions: { some: { published: true } } },
    orderBy: [{ title: 'asc' }],
    include: {
      artists: { include: { artist: true }, orderBy: { position: 'asc' } },
      versions: {
        where: { published: true },
        orderBy: { version: 'desc' },
        take: 1,
        include: { lines: { orderBy: { index: 'asc' } }, annotations: true },
      },
    },
  });

  let written = 0;
  for (const song of songs) {
    const version = song.versions[0];
    if (!version) continue;
    const primary = song.artists.find((entry) => entry.isPrimary) ?? song.artists[0];
    if (!primary) {
      console.warn(`skip ${song.slug}: no artist, cannot name the frontmatter`);
      continue;
    }
    const featuring = song.artists
      .filter((entry) => entry.artistId !== primary.artistId)
      .map((entry) => entry.artist.name);

    const document = {
      frontmatter: {
        title: song.title,
        artist: primary.artist.name,
        featuring,
        youtubeVideoId: song.youtubeVideoId,
        language: song.language,
        ...(song.releaseDate ? { releaseDate: song.releaseDate.toISOString().slice(0, 10) } : {}),
        status: 'published',
      },
      lyrics: {
        syncStatus: version.syncStatus,
        lines: version.lines.map((line) => ({ index: line.index, startMs: line.startMs, text: line.text })),
        annotations: version.annotations.map((annotation) => ({
          phrase: annotation.phrase,
          explanation: annotation.explanation,
          ...(annotation.lineIndex == null ? {} : { lineIndex: annotation.lineIndex }),
        })),
      },
    };

    const path = join(CONTENT_DIR, slugify(primary.artist.name), `${slugify(song.title)}.md`);
    const body = serializeLyricsDocument(document);
    if (!DRY_RUN) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body, 'utf8');
    }
    written += 1;
  }

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Exported ${written} published song(s) to content/.`);
}

/** Every `.md` under `content/`, recursively. */
async function listMarkdownFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await listMarkdownFiles(full));
    else if (/\.(md|markdown)$/i.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Serialise the lyrics part of a document back to the text form a submission
 * stores, so a file edit produces a comparable `markdown` body.
 */
function toSubmissionMarkdown(document) {
  return document.lyrics.lines
    .map((line) => (line.startMs < 0 ? line.text : `[${msToTimestamp(line.startMs)}] ${line.text}`))
    .join('\n');
}

async function importCatalogue() {
  const files = await listMarkdownFiles(CONTENT_DIR);
  if (!files.length) {
    console.log('No Markdown files found under content/. Nothing to import.');
    return;
  }

  const summary = { created: 0, unchanged: 0, pending: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    const label = relative(CONTENT_DIR, file).split(sep).join('/');
    const source = await readFile(file, 'utf8');
    const parsed = parseLyricsDocument(source);
    if (!parsed.ok) {
      summary.failed += 1;
      const messages = Object.entries(parsed.errors).flatMap(([field, list]) => list.map((message) => `${field}: ${message}`));
      console.error(`✗ ${label}\n  ${messages.join('\n  ')}`);
      continue;
    }

    const { frontmatter, lyrics } = parsed.document;
    const song = await prisma.song.findFirst({
      where: { youtubeVideoId: frontmatter.youtubeVideoId, status: 'published' },
      include: { versions: { where: { published: true }, orderBy: { version: 'desc' }, take: 1, include: { lines: { orderBy: { index: 'asc' } }, annotations: true } } },
    });

    if (!song) {
      summary.skipped += 1;
      console.warn(`· ${label}: no published song with video ${frontmatter.youtubeVideoId}; import only updates existing catalogue songs`);
      continue;
    }

    const markdown = toSubmissionMarkdown(parsed.document);
    const version = song.versions[0];

    if (version && isSameAsPublished(version, lyrics, markdown)) {
      summary.unchanged += 1;
      continue;
    }

    const existingPending = await prisma.lyricsSubmission.findFirst({
      where: { songId: song.id, status: { in: ['pending', 'changes_requested'] } },
      select: { id: true, markdown: true },
    });
    if (existingPending?.markdown === markdown) {
      summary.unchanged += 1;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.lyricsSubmission.create({
        data: { songId: song.id, markdown, note: `Imported from ${label}`, status: 'pending' },
      });
    }
    summary.pending += 1;
    console.log(`${DRY_RUN ? '[dry run] ' : ''}+ ${label}: pending submission for “${song.title}”`);
  }

  console.log(
    `${DRY_RUN ? '[dry run] ' : ''}Import finished: ${summary.pending} pending, ${summary.unchanged} unchanged, `
    + `${summary.skipped} skipped, ${summary.failed} failed.`,
  );
  if (summary.failed > 0) process.exitCode = 1;
}

/** True when the file says nothing different from the published version. */
function isSameAsPublished(version, lyrics, markdown) {
  const publishedMarkdown = version.lines
    .map((line) => (line.startMs < 0 ? line.text : `[${msToTimestamp(line.startMs)}] ${line.text}`))
    .join('\n');
  if (publishedMarkdown !== markdown) return false;

  const publishedAnnotations = version.annotations
    .map((annotation) => `${annotation.lineIndex ?? ''}|${annotation.phrase}|${annotation.explanation}`)
    .sort();
  const fileAnnotations = lyrics.annotations
    .map((annotation) => `${annotation.lineIndex ?? ''}|${annotation.phrase}|${annotation.explanation}`)
    .sort();
  return publishedAnnotations.length === fileAnnotations.length
    && publishedAnnotations.every((value, index) => value === fileAnnotations[index]);
}

async function main() {
  const command = process.argv[2];
  try {
    if (command === 'export') await exportCatalogue();
    else if (command === 'import') await importCatalogue();
    else {
      console.error('Usage: node scripts/content.mjs <export|import> [--dry-run]');
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

await main();
