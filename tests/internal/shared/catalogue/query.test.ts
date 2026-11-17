import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogueSearchParams,
  compileOrderPlan,
  DEFAULT_SONG_SORT,
  pageNumber,
  parseCatalogueQuery,
} from '../../../../packages/shared/src/catalogue-query.ts';

/**
 * The catalogue query contract.
 *
 * Two things matter and are easy to get wrong: an unknown sort must be refused
 * rather than quietly replaced, and "recently synced" must never be asked of
 * songs that have never been timed.
 */

test('an empty query becomes the shipped default order', () => {
  const result = parseCatalogueQuery({});
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.query, { sort: DEFAULT_SONG_SORT, page: 1 });
});

test('parses every supported filter', () => {
  const result = parseCatalogueQuery({ q: '  bars ', artist: 'stivo', sync: 'synced', language: 'sheng', sort: 'title', page: '3' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.query, { q: 'bars', artist: 'stivo', sync: 'synced', language: 'sheng', sort: 'title', page: 3 });
});

test('accepts sort and filter values case-insensitively', () => {
  const result = parseCatalogueQuery({ sync: 'SYNCED', sort: 'Recently-Synced' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.query.sync, 'synced');
  assert.equal(result.query.sort, 'recently-synced');
});

test('an unknown sort is refused, not silently defaulted', () => {
  const result = parseCatalogueQuery({ sort: 'alphabetical' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.field, 'sort');
  assert.match(result.errors[0]?.message ?? '', /newest, title, artist, recently-synced/);
});

test('every bad field is reported in one response', () => {
  const result = parseCatalogueQuery({ sort: 'nope', sync: 'timed', language: 'kikuyu' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors.map((error) => error.field), ['sync', 'language', 'sort']);
});

test('a page number is clamped, never rejected', () => {
  // A mangled link is not a request for a different catalogue.
  assert.equal(pageNumber('0'), 1);
  assert.equal(pageNumber('-4'), 1);
  assert.equal(pageNumber('2.5'), 1);
  assert.equal(pageNumber('abc'), 1);
  assert.equal(pageNumber('4'), 4);
  assert.equal(pageNumber('999999'), 10_000);
});

test('recently-synced implies synced, and orders by sync time', () => {
  const plan = compileOrderPlan({ sort: 'recently-synced' });
  assert.equal(plan.sync, 'synced');
  assert.deepEqual(plan.keys, ['syncedAt', 'id']);
  assert.deepEqual(plan.directions, ['desc', 'asc']);
});

test('an explicit unsynced filter is not overridden by a default sort', () => {
  const plan = compileOrderPlan({ sort: 'newest', sync: 'unsynced' });
  assert.equal(plan.sync, 'unsynced');
  assert.deepEqual(plan.keys, ['releaseDate', 'id']);
});

test('every order ends on a unique key so pagination cannot repeat a song', () => {
  for (const sort of ['newest', 'title', 'recently-synced'] as const) {
    const plan = compileOrderPlan({ sort });
    assert.equal(plan.keys[plan.keys.length - 1], 'id', `${sort} must tie-break on id`);
  }
});

test('the default catalogue URL stays bare', () => {
  assert.equal(catalogueSearchParams({}), '');
  assert.equal(catalogueSearchParams({ sort: 'newest', page: 1 }), '');
});

test('a filtered URL carries only what was chosen', () => {
  const qs = catalogueSearchParams({ sync: 'synced', sort: 'recently-synced', page: 2 });
  const parsed = new URLSearchParams(qs);
  assert.equal(parsed.get('sync'), 'synced');
  assert.equal(parsed.get('sort'), 'recently-synced');
  assert.equal(parsed.get('page'), '2');
  assert.equal(parsed.has('language'), false);
});

test('what the web app builds, the API parses back identically', () => {
  const original = { q: 'keroro', artist: 'masicka', sync: 'synced' as const, language: 'sheng' as const, sort: 'title' as const, page: 2 };
  const parsed = parseCatalogueQuery(Object.fromEntries(new URLSearchParams(catalogueSearchParams(original))));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.query, original);
});