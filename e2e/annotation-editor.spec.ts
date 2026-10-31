import { test, expect, type Page } from '@playwright/test';

/**
 * Moderator annotation flow, end to end (`docs/roadmap.md` Phase 1:
 * "Moderator annotation editor: anchor Sheng/slang explanations to reviewed
 * lines, validate with `resolveAnnotations`, publish with the version").
 *
 * Runs against the Docker stack (`docs/runbook.md`). It drives the **real admin
 * UI** — sign in, review queue, annotation editor — and then asserts the result
 * on the **public song page**, because an annotation that saves but never
 * renders is the failure mode this test exists to catch.
 *
 * Fixtures are fictional (`docs/context.md` §Testing: "Tests must use fictional
 * or properly licensed content"), and each run submits lyrics that are unique
 * to it, so a leftover row from an earlier run cannot make the test pass on
 * stale data.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@drillke.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
/** A published song from the seed — submissions are tied to the catalogue. */
const CATALOGUE_SONG_SLUG = process.env.E2E_SONG_SLUG ?? 'masicka-update-official-video';

const PHRASE = 'beat inawaka';
const EXPLANATION = 'E2E: the beat is lit — fictional explanation for the annotation test.';

test.describe('moderator annotation editor', () => {
  test.skip(
    !ADMIN_PASSWORD,
    'Set E2E_ADMIN_PASSWORD to the seeded admin password (see docs/runbook.md).',
  );

  test('anchors an explanation to a reviewed line and publishes it', async ({ page, request }) => {
    const health = await request.get(`${API_URL}/api/health/ready`);
    test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack (docs/runbook.md).`);

    // A per-run marker keeps this submission findable and never reuses an
    // earlier run's row, which may already be published.
    const marker = `E2E-${Date.now()}`;
    const lyrics = [
      `${PHRASE} ${marker}`,
      'Tunaingia ndani bila kubisha',
      'Sheng test line for the reviewer',
    ].join('\n');

    const submissionId = await test.step('a contributor submits lyrics', async () => {
      const songs = await request.get(`${API_URL}/api/songs?q=${encodeURIComponent(CATALOGUE_SONG_SLUG)}`);
      expect(songs.ok(), 'the songs list must be readable').toBeTruthy();
      const song = (await songs.json() as { items: { id: string; slug: string }[] }).items
        .find((item) => item.slug === CATALOGUE_SONG_SLUG);
      expect(song, `seeded song ${CATALOGUE_SONG_SLUG} must exist — run npm run db:seed`).toBeTruthy();

      const created = await request.post(`${API_URL}/api/lyrics/submissions`, {
        data: { songId: song!.id, markdown: lyrics, note: marker },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const body = await created.json() as { id: string; status: string };
      expect(body.status).toBe('pending');
      return body.id;
    });

    await test.step('a moderator signs in', async () => {
      await page.goto('/sign-in');
      await page.getByLabel('Email').fill(ADMIN_EMAIL);
      await page.getByLabel('Password').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL(/\/admin$/, { timeout: 20_000 });
      await expect(page.getByRole('heading', { name: 'Review & catalogue' })).toBeVisible();
    });

    // The card for *this* submission. Scoping every later query to it is what
    // stops the test from passing on some other pending review in the queue.
    const card = page.locator('article.lyrics-review-card').filter({ hasText: marker });

    await test.step('the submission is in the pending queue', async () => {
      await page.getByRole('button', { name: 'Lyrics review' }).click();
      await expect(page.getByLabel('Submission status')).toHaveValue('pending');
      await expect(card).toBeVisible();
      await expect(card.getByText(`${PHRASE} ${marker}`)).toBeVisible();
    });

    await test.step('an annotation is anchored to the first line', async () => {
      const editor = card.getByRole('region', { name: 'Lyric annotations' });
      await editor.getByLabel('Line').selectOption({ index: 0 });
      await editor.getByLabel('Phrase').fill(PHRASE);
      await editor.getByLabel('Explanation').fill(EXPLANATION);
      await editor.getByRole('button', { name: 'Add annotation' }).click();

      // The editor lists it, and `resolveAnnotations` accepted it (no alert).
      await expect(editor.getByText(new RegExp(PHRASE))).toBeVisible();
      await expect(editor.locator('[role="alert"]')).toHaveCount(0);
      await expect(editor.getByText('1 annotation')).toBeVisible();
    });

    await test.step('a phrase that is not on the line is refused', async () => {
      // The documented contract (`docs/lyrics-format.md` §2): the phrase must
      // appear in the line it is anchored to. A phrase from a *different* line
      // must leave the Add button disabled rather than saving a drifting anchor.
      const editor = card.getByRole('region', { name: 'Lyric annotations' });
      await editor.getByLabel('Line').selectOption({ index: 1 });
      await editor.getByLabel('Phrase').fill(PHRASE);
      await editor.getByLabel('Explanation').fill('This phrase is not on line 2.');
      await expect(editor.getByRole('button', { name: 'Add annotation' })).toBeDisabled();
      await editor.getByLabel('Phrase').fill('');
      await editor.getByLabel('Explanation').fill('');
    });

    await test.step('approving publishes the version with its annotation', async () => {
      await card.getByRole('button', { name: /Approve & publish/ }).click();
      await expect(page.getByRole('status')).toContainText('Saved.');
      // The card leaves the pending queue once published.
      await expect(page.locator('article.lyrics-review-card').filter({ hasText: marker })).toHaveCount(0);
    });

    await test.step('the annotation renders on the public song page', async () => {
      await page.goto(`/songs/${CATALOGUE_SONG_SLUG}`);
      const trigger = page.getByRole('button', { name: new RegExp(`${PHRASE} · meaning`) });
      await expect(trigger).toBeVisible();
      await trigger.click();
      await expect(page.getByRole('note')).toHaveText(EXPLANATION);
    });

    // Leave the catalogue as it was found: the fixture's version is real
    // published data now, and an unpublish keeps reruns honest.
    await test.step('cleanup', async () => {
      const unpublished = await request.post(`${API_URL}/api/admin/lyrics/${submissionId}/unpublish`, {
        data: { reason: 'E2E fixture cleanup' },
        headers: { cookie: await staffCookie(page) },
      });
      expect(unpublished.status(), await unpublished.text()).toBeLessThan(300);
    });
  });
});

/**
 * The staff session cookie, so cleanup calls go out as the signed-in moderator
 * rather than as an anonymous request that the role guard would reject.
 */
async function staffCookie(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}
