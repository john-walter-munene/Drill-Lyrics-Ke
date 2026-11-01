import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPublishedVersion } from './published-version.ts';

/**
 * Which lyric version the public lyrics endpoint serves.
 *
 * Unpublishing flips `published` on one version, so "newest published row" falls
 * back to an older, already-superseded edition. The live version is the one
 * `Song.syncedVersionId` points at.
 */

const versions = [{ id: 'v2' }, { id: 'v1' }]; // newest first, as the query returns them

test('serves the version the song points at, not merely the newest published one', () => {
  // v3 was just unpublished, so it is absent; v2 is newest but superseded.
  assert.deepEqual(selectPublishedVersion(versions, 'v1'), { id: 'v1' });
});

test('falls back to the newest published version when the pointer is unset', () => {
  assert.deepEqual(selectPublishedVersion(versions, null), { id: 'v2' });
});

test('ignores a pointer to a version that is no longer published', () => {
  // A stale pointer must not resurrect an unpublished edition.
  assert.deepEqual(selectPublishedVersion(versions, 'v9'), { id: 'v2' });
});

test('reports no version when nothing is published', () => {
  assert.equal(selectPublishedVersion([], 'v1'), null);
});
