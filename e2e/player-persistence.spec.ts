import { test, expect } from '@playwright/test';

/**
 * The player is mounted once above the routes, so moving around the app must
 * never interrupt or restart the track that is playing.
 *
 * This is a regression test for a real failure: navigating replaced the player's
 * container, the YouTube player was never re-initialised on the new one, and the
 * shell went blank while the audio stopped.
 */

const surface = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Music player' });

async function playingTitle(page: import('@playwright/test').Page) {
  await expect(surface(page).locator('.player-play-button').first()).toHaveText(/Ⅱ/, { timeout: 40_000 });
  return (await surface(page).locator('.player-shell__bar-track strong').first().innerText()).trim();
}

async function positionSeconds(page: import('@playwright/test').Page) {
  const text = (await surface(page).locator('.player-shell__bar-time').first().innerText()).trim();
  const clock = text.split('/')[0].trim();
  const [minutes, seconds] = clock.split(':').map(Number);
  return minutes * 60 + seconds;
}

test.skip(
  process.env.PLAYER_E2E !== 'true',
  'Plays real YouTube video; set PLAYER_E2E=true to run it against a live stack.',
);

test('playback continues across every section of the app', async ({ page }) => {
  await page.goto('/songs');
  await page.getByRole('button', { name: '▶ Play' }).nth(4).click();
  const title = await playingTitle(page);
  await page.waitForTimeout(4000);
  const start = await positionSeconds(page);

  const hops: [string, RegExp][] = [
    ['Artists', /\/artists$/],
    ['DJs & Mixes', /\/djs$/],
    ['Podcasts', /\/podcasts$/],
    ['Events', /\/events$/],
    ['Songs & Lyrics', /\/songs$/],
  ];
  for (const [label, url] of hops) {
    await page.getByRole('link', { name: label, exact: true }).first().click();
    await page.waitForURL(url);
    await page.waitForTimeout(2500);
    await expect(surface(page).locator('.player-play-button').first(), `stopped on ${label}`).toHaveText('Ⅱ');
    await expect(surface(page).locator('.player-shell__bar-track strong').first()).toHaveText(title);
    // The YouTube player is mounted: the container becomes the iframe.
    await expect(page.locator('iframe.player-shell__iframe')).toHaveCount(1);
  }

  // Into a song page and out to its artist: the two routes that used to
  // re-register the track and restart it.
  await page.locator('.song-list-item a[href^="/songs/"]').nth(7).click();
  await page.waitForURL(/\/songs\/[^/]+$/);
  await page.waitForTimeout(2000);
  const onSongPage = await surface(page).locator('.player-shell__bar-track strong').first().innerText();
  await page.locator('a[href^="/artists/"]').first().click();
  await page.waitForURL(/\/artists\/[^/]+$/);
  await page.waitForTimeout(2000);
  await expect(surface(page).locator('.player-play-button').first()).toHaveText('Ⅱ');

  // A song page only takes over when nothing is playing.
  expect(onSongPage.trim()).toBe(title);
  expect(await positionSeconds(page), 'the clock must keep advancing').toBeGreaterThan(start + 5);
});

test('listen mode carries over to the next song and survives a reload', async ({ page }) => {
  await page.goto('/songs');
  await page.getByRole('button', { name: '▶ Play' }).nth(1).click();
  await playingTitle(page);

  await surface(page).getByRole('button', { name: 'Listen' }).click();
  await expect(surface(page).getByRole('button', { name: 'Listen' })).toHaveAttribute('aria-pressed', 'true');

  // Choosing another song must not revert to Watch.
  await page.getByRole('button', { name: '▶ Play' }).nth(5).click();
  await expect(page.locator('.player-shell')).toHaveClass(/player-shell--listen/);
  await expect(surface(page).getByRole('button', { name: 'Listen' })).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('.player-shell')).toHaveClass(/player-shell--listen/);
});
