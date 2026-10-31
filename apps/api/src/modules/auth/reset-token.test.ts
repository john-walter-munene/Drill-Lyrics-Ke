import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONFIRM_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  buildConfirmUrl,
  buildResetUrl,
  createResetToken,
  hashResetToken,
  isTokenUsable,
  looksLikeResetToken,
} from './reset-token.ts';

test('createResetToken returns 256 bits of base64url', () => {
  const token = createResetToken();
  // 32 bytes → 43 base64url characters, no padding.
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(looksLikeResetToken(token));
});

test('tokens are unique across a realistic batch', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1_000; i += 1) seen.add(createResetToken());
  assert.equal(seen.size, 1_000, 'a duplicate token would let one link reset two accounts');
});

test('the stored hash is deterministic and never the token', () => {
  const token = createResetToken();
  const hash = hashResetToken(token);
  assert.equal(hash, hashResetToken(token), 'a reset would never find its row otherwise');
  assert.notEqual(hash, token, 'storing the token itself is the bug this function exists to prevent');
  // SHA-256 → 32 bytes → 43 base64url chars.
  assert.equal(hash.length, 43);
  assert.match(hash, /^[A-Za-z0-9_-]+$/);
});

test('different tokens hash differently', () => {
  assert.notEqual(hashResetToken(createResetToken()), hashResetToken(createResetToken()));
});

test('looksLikeResetToken rejects malformed values before a database trip', () => {
  for (const bad of ['', 'short', 'a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + '!', ' '.repeat(43)]) {
    assert.equal(looksLikeResetToken(bad), false, JSON.stringify(bad));
  }
  assert.ok(looksLikeResetToken('a'.repeat(43)));
  assert.ok(looksLikeResetToken('_-'.repeat(21) + 'a'));
});

test('buildResetUrl puts the token in the path with no double slash', () => {
  const token = 'x'.repeat(43);
  assert.equal(buildResetUrl('https://drillke.com', token), `https://drillke.com/reset-password/${token}`);
  assert.equal(buildResetUrl('https://drillke.com/', token), `https://drillke.com/reset-password/${token}`);
  assert.equal(buildResetUrl('https://drillke.com///', token), `https://drillke.com/reset-password/${token}`);
  // The token must not appear in a query string, where it leaks via Referer.
  assert.ok(!buildResetUrl('https://drillke.com', token).includes('?token='));
});

test('the confirmation link uses its own path, so the two link types cannot be confused', () => {
  const token = 'y'.repeat(43);
  assert.equal(buildConfirmUrl('https://drillke.com', token), `https://drillke.com/confirm-email/${token}`);
  assert.equal(buildConfirmUrl('https://drillke.com/', token), `https://drillke.com/confirm-email/${token}`);
  // Never the reset path: a confirmation link must not be spendable as a reset.
  assert.ok(!buildConfirmUrl('https://drillke.com', token).includes('reset-password'));
  assert.ok(!buildResetUrl('https://drillke.com', token).includes('confirm-email'));
});

test('a confirmation link outlives a reset link', () => {
  // People open a sign-up email the next day; an hour would be hostile.
  assert.ok(CONFIRM_TOKEN_TTL_MS > RESET_TOKEN_TTL_MS);
  assert.equal(CONFIRM_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});

test('isTokenUsable respects expiry and single use', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  const inAnHour = new Date(now.getTime() + 3_600_000);
  const anHourAgo = new Date(now.getTime() - 3_600_000);

  assert.equal(isTokenUsable({ expiresAt: inAnHour, usedAt: null }, now), true);
  assert.equal(isTokenUsable({ expiresAt: anHourAgo, usedAt: null }, now), false, 'expired');
  assert.equal(isTokenUsable({ expiresAt: inAnHour, usedAt: now }, now), false, 'already spent');
  assert.equal(
    isTokenUsable({ expiresAt: anHourAgo, usedAt: anHourAgo }, now),
    false,
    'a spent and expired token is still unusable',
  );
  // Exactly on the boundary the link is gone: expiry is exclusive.
  assert.equal(isTokenUsable({ expiresAt: now, usedAt: null }, now), false);
});
