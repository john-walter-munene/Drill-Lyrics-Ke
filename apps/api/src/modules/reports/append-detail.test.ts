import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendDetail } from './report-detail.ts';

/**
 * Duplicate reports collapse into one row. The row's `detail` is the *first*
 * reporter's statement, so folding in a later report must append to it — an
 * earlier version replaced it, which meant a moderator saw only the latest
 * complaint and the original statement was lost.
 */

test('the first detail is kept and the new report is appended', () => {
  const folded = appendDetail('Wrong verse two entirely.', { reason: 'Wrong lyrics', detail: 'Line 4 is missing' });
  const [first, second] = folded.split('\n');
  assert.equal(first, 'Wrong verse two entirely.');
  assert.equal(second, 'Additional report — Wrong lyrics: Line 4 is missing');
});

test('a fold into an empty detail starts with the additional report', () => {
  assert.equal(appendDetail(null, { reason: 'Spam' }), 'Additional report — Spam');
});

test('a first report keeps a reason-only line when no detail is given', () => {
  assert.equal(appendDetail('', { reason: 'Spam', detail: '   ' }), 'Additional report — Spam');
});

test('the folded detail stays bounded', () => {
  const long = 'x'.repeat(1_900);
  const folded = appendDetail(long, { reason: 'y'.repeat(120), detail: 'z'.repeat(2_000) });
  assert.ok(folded.length <= 2_000, `got ${folded.length}`);
});
