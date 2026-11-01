import { test, expect } from '@playwright/test';

/**
 * The home page's "Start here" shelf is drawn at random from the whole
 * catalogue. It used to be the first page of `/api/songs`, so every visitor saw
 * the same six records until the next deployment.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

test('the random shelf is drawn from across the catalogue, not its first page', async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  const catalogue = await (await request.get(`${API_URL}/api/songs?page=1`)).json() as { items: { slug: string }[]; total: number };

  const seen = new Set<string>();
  for (let draw = 0; draw < 5; draw += 1) {
    const feeds = await (await request.get(`${API_URL}/api/songs/feeds`)).json() as { randomSongs: { slug: string }[] };
    expect(feeds.randomSongs.length).toBeGreaterThan(0);
    // Never more than the catalogue holds, and never a repeat within one draw.
    expect(feeds.randomSongs.length).toBeLessThanOrEqual(Math.min(6, catalogue.total));
    expect(new Set(feeds.randomSongs.map((song) => song.slug)).size).toBe(feeds.randomSongs.length);
    feeds.randomSongs.forEach((song) => seen.add(song.slug));
  }

  if (catalogue.total <= 6) {
    // Too small a catalogue to be random about; the shelf is simply all of it.
    expect(seen.size).toBe(catalogue.total);
    return;
  }
  // Five draws of six must surface more than a single page could.
  expect(seen.size, 'five draws should not repeat the same six songs').toBeGreaterThan(6);
});

test('the home page renders the shelf with play buttons', async ({ page }) => {
  await page.goto('/');
  const shelf = page.locator('#start-listening');
  await expect(shelf.locator('.song-list-item').first()).toBeVisible();
  expect(await shelf.getByRole('button', { name: '▶ Play' }).count()).toBeGreaterThan(0);
});
