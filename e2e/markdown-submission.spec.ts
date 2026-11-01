import { test, expect } from '@playwright/test';

/**
 * Markdown submission, end to end (`docs/roadmap.md` Phase 2:
 * "Upload a Markdown file + paste editor").
 *
 * Covers the contributor's half of the flow, which is the part with UI: paste a
 * document into `/submit`, see it validated live, and have the server accept it.
 * The moderator half is covered by `annotation-editor.spec.ts`.
 *
 * The API assertions run first and are the ones that would catch a regression in
 * `parseLyricsDocument` reaching production; the browser steps prove the form
 * actually wires it up.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const CATALOGUE_SONG_SLUG = process.env.E2E_SONG_SLUG ?? 'masicka-update-official-video';

function documentFor(marker: string): string {
  return [
    '---',
    'title: "E2E Markdown Fixture"',
    'artist: "E2E Artist"',
    `youtubeVideoId: "dQw4w9WgXcQ"`,
    'language: mixed',
    '---',
    '',
    '# Lyrics',
    '',
    `[00:01.000] Niaje msee ${marker}`,
    '[00:03.500] Tunaingia ndani',
    '',
    '## Annotations',
    '',
    '- **"Niaje"** — Fictional greeting used by the E2E fixture.',
    '',
  ].join('\n');
}

test.describe('markdown submission', () => {
  test('the API rejects an invalid document with field-level errors', async ({ request }) => {
    const health = await request.get(`${API_URL}/api/health/ready`);
    test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack (docs/runbook.md).`);

    // By slug, not by title: `?q=` is a title search and can never match a slug
    // such as `masicka-update-official-video`.
    const songRes = await request.get(`${API_URL}/api/songs/${encodeURIComponent(CATALOGUE_SONG_SLUG)}`);
    expect(songRes.ok(), `seeded song ${CATALOGUE_SONG_SLUG} must exist — run npm run db:seed`).toBeTruthy();
    const song = (await songRes.json()) as { id: string; slug: string };
    expect(song.id).toBeTruthy();

    // An unknown frontmatter key must be refused, not ignored.
    const bad = documentFor('bad').replace('language: mixed', 'language: mixed\nlangauge: typo');
    const rejected = await request.post(`${API_URL}/api/lyrics/submissions`, {
      data: { songId: song.id, markdown: bad },
    });
    expect(rejected.status()).toBe(422);
    const body = await rejected.json() as { message?: { langauge?: string[] } };
    expect(JSON.stringify(body)).toContain('unknown frontmatter key');
  });

  test('a valid document is accepted as a pending submission', async ({ request }) => {
    const health = await request.get(`${API_URL}/api/health/ready`);
    test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack (docs/runbook.md).`);

    // By slug: `?q=` searches titles, never slugs.
    const songRes = await request.get(`${API_URL}/api/songs/${encodeURIComponent(CATALOGUE_SONG_SLUG)}`);
    expect(songRes.ok(), `seeded song ${CATALOGUE_SONG_SLUG} must exist — run npm run db:seed`).toBeTruthy();
    const song = (await songRes.json()) as { id: string };

    const created = await request.post(`${API_URL}/api/lyrics/submissions`, {
      data: { songId: song.id, markdown: documentFor(`E2E-${Date.now()}`) },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    expect((await created.json() as { status: string }).status).toBe('pending');
  });

  test('the paste editor validates the document before submitting', async ({ page }) => {
    await page.goto('/submit');

    await page.getByRole('radio', { name: 'Markdown file with frontmatter' }).check();

    const editor = page.getByLabel('Or paste the document');
    await editor.fill('---\ntitle: "Broken"\nartist: "A"\nyoutubeVideoId: "nope"\n---\n\nline');
    // Live validation, so the contributor sees the problem without a round trip.
    // Scoped to the form: the page shell renders its own alerts too.
    await expect(page.locator('form').getByRole('alert')).toContainText('11-character YouTube video id');
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled();

    await editor.fill(documentFor('E2E-UI'));
    await expect(page.getByRole('status').filter({ hasText: 'Ready:' })).toBeVisible();
    await expect(page.locator('form').getByRole('alert')).toHaveCount(0);
  });

  test('an uploaded .md file fills the editor', async ({ page }) => {
    await page.goto('/submit');
    await page.getByRole('radio', { name: 'Markdown file with frontmatter' }).check();

    await page.getByLabel('Upload a Markdown file').setInputFiles({
      name: 'e2e-fixture.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(documentFor('E2E-UPLOAD')),
    });

    await expect(page.getByText('Loaded e2e-fixture.md')).toBeVisible();
    await expect(page.getByLabel('Or paste the document')).toHaveValue(/E2E-UPLOAD/);
    await expect(page.getByRole('status').filter({ hasText: 'Ready:' })).toBeVisible();
  });

  test('a non-Markdown file is refused with a clear message', async ({ page }) => {
    await page.goto('/submit');
    await page.getByRole('radio', { name: 'Markdown file with frontmatter' }).check();

    await page.getByLabel('Upload a Markdown file').setInputFiles({
      name: 'artwork.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not really a png'),
    });

    await expect(page.locator('form').getByRole('alert')).toContainText('Choose a Markdown file');
  });
});
