import { test, expect } from '@playwright/test';

/**
 * Catalogue filters and ordering.
 *
 * `/songs` now carries sync, language and sort in the URL, and the API is the
 * one place those rules are enforced (`parseCatalogueQuery` in
 * `@drillke/shared`). These checks prove the contract holds against a live
 * stack rather than against the pure functions alone.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4000';type SongRow = { slug: string; syncedAt: string | null; lyrics: { syncStatus: string } };
type SongPage = { items: SongRow[]; total: number };

async function apiReady(request: import('@playwright/test').APIRequestContext) {
  const health = await request.get(`${API_URL}/api/health/ready`);
  return health.ok();
}

test('an unknown sort is refused with a 400 that names the valid values', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const res = await request.get(`${API_URL}/api/songs?sort=alphabetical`);
  expect(res.status(), 'an unknown sort must not be silently defaulted').toBe(400);
  const body = await res.json() as { message: string[] | string };
  expect(JSON.stringify(body.message)).toContain('recently-synced');
});

test('every bad filter field is reported in one response', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const res = await request.get(`${API_URL}/api/songs?sync=timed&language=kikuyu&sort=nope`);
  expect(res.status()).toBe(400);
  const body = await res.json() as { errors?: { field: string }[] };
  expect((body.errors ?? []).map((error) => error.field).sort()).toEqual(['language', 'sort', 'sync']);
});

test('sync=synced returns only songs with a timed version', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const page = await (await request.get(`${API_URL}/api/songs?sync=synced`)).json() as SongPage;
  for (const song of page.items) {
    expect(song.lyrics.syncStatus, `${song.slug} is in the synced view`).toBe('synchronized');
    expect(song.syncedAt, `${song.slug} carries a sync date`).not.toBeNull();
  }
});

test('sync=unsynced returns only songs without a timed version', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const page = await (await request.get(`${API_URL}/api/songs?sync=unsynced`)).json() as SongPage;
  for (const song of page.items) {
    expect(song.lyrics.syncStatus, `${song.slug} is in the unsynced view`).not.toBe('synchronized');
    expect(song.syncedAt, `${song.slug} has no sync date`).toBeNull();
  }
});

test('the synced and unsynced views partition the catalogue', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const all = await (await request.get(`${API_URL}/api/songs`)).json() as SongPage;
  const synced = await (await request.get(`${API_URL}/api/songs?sync=synced`)).json() as SongPage;
  const unsynced = await (await request.get(`${API_URL}/api/songs?sync=unsynced`)).json() as SongPage;
  // Nothing is lost and nothing is counted twice.
  expect(synced.total + unsynced.total, 'every published song is in exactly one view').toBe(all.total);
});

test('recently-synced orders by sync time, newest first', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const page = await (await request.get(`${API_URL}/api/songs?sort=recently-synced`)).json() as SongPage;
  const times = page.items.map((song) => Date.parse(song.syncedAt ?? ''));
  for (const time of times) expect(Number.isNaN(time), 'a sync date is a real timestamp').toBe(false);
  const sorted = [...times].sort((a, b) => b - a);
  expect(times, 'recently-synced is descending').toEqual(sorted);
});

test('recently-synced never includes a song that has not been timed', async ({ request }) => {
  test.skip(!(await apiReady(request)), `API not reachable at ${API_URL}; start the stack.`);

  const page = await (await request.get(`${API_URL}/api/songs?sort=recently-synced`)).json() as SongPage;
  for (const song of page.items) {
    expect(song.syncedAt, 'recently-synced forces the synced filter').not.toBeNull();
  }
});

test('filter state lives in the URL and survives a page load', async ({ page }) => {
  const health = await page.request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  await page.goto('/songs?sync=synced&sort=recently-synced');
  // Clicking a filter navigates, so the result is server-rendered and shareable.
  const active = page.locator('.song-filters__pill--active');
  await expect(active.filter({ hasText: 'Synchronized' })).toHaveCount(1);
  await expect(active.filter({ hasText: 'Recently synced' })).toHaveCount(1);

  // A reload must land on the same filtered view: nothing is held in memory.
  await page.reload();
  await expect(page).toHaveURL(/sync=synced/);
  await expect(active.filter({ hasText: 'Synchronized' })).toHaveCount(1);
});

test('the home "See all synced" link reaches the recently-synced view', async ({ page }) => {
  const health = await page.request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  await page.goto('/');
  const link = page.getByRole('link', { name: 'See all synced' });
  if (await link.count() === 0) test.skip(true, 'No synced songs yet, so the shelf and its link are absent.');
  await link.click();
  await expect(page).toHaveURL(/\/songs\?.*sync=synced/);
  await expect(page.locator('.song-filters__pill--active').filter({ hasText: 'Recently synced' })).toHaveCount(1);
});