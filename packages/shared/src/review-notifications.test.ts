import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReviewNotification, shouldNotify } from './review-notifications.ts';

const base = {
  songTitle: 'Example Track',
  submissionId: 'sub_123',
  siteUrl: 'https://drillke.example',
};

test('approval links to the published song and states sync status honestly', () => {
  const synced = buildReviewNotification({
    ...base,
    outcome: 'approved',
    songUrl: 'https://drillke.example/songs/example-track',
    syncStatus: 'synchronized',
  });
  assert.match(synced.subject, /are live/);
  assert.match(synced.text, /https:\/\/drillke\.example\/songs\/example-track/);
  assert.match(synced.text, /synchronized, so they highlight/);
  assert.match(synced.text, /sub_123/);

  // An unsynchronized approval must not claim highlighting.
  const unsynced = buildReviewNotification({ ...base, outcome: 'approved', syncStatus: 'unsynchronized' });
  assert.match(unsynced.text, /not yet synchronized/);
  assert.doesNotMatch(unsynced.text, /so they highlight/);
});

test('approval never promises payment', () => {
  const approved = buildReviewNotification({ ...base, outcome: 'approved' });
  assert.match(approved.text, /Credit is recognition, not payment/);
  assert.doesNotMatch(approved.text, /\bpaid\b|\bpayment for\b|\bwill pay\b/i);
});

test('changes requested includes the reviewer note and reassures the contributor', () => {
  const message = buildReviewNotification({
    ...base,
    outcome: 'changes_requested',
    note: 'Line 3 has the wrong timestamp.',
  });
  assert.match(message.subject, /Changes requested/);
  assert.match(message.text, /Line 3 has the wrong timestamp\./);
  assert.match(message.text, /still in the queue/);
});

test('a rejection with no recorded reason says so rather than inventing one', () => {
  const message = buildReviewNotification({ ...base, outcome: 'rejected', note: '   ' });
  assert.match(message.subject, /not accepted/);
  assert.match(message.text, /No reason was recorded/);
  assert.doesNotMatch(message.text, /\bqueue\b/);
});

test('rejection notes are shown verbatim', () => {
  const message = buildReviewNotification({ ...base, outcome: 'rejected', note: 'Duplicate of an existing submission.' });
  assert.match(message.text, /Duplicate of an existing submission\./);
});

test('a blank song title falls back to readable prose', () => {
  const message = buildReviewNotification({ ...base, outcome: 'approved', songTitle: '   ' });
  assert.match(message.text, /lyrics for “a song”/);
});

test('notifications are deterministic', () => {
  const input = { ...base, outcome: 'approved' as const, note: 'x' };
  assert.deepEqual(buildReviewNotification(input), buildReviewNotification(input));
});

test('every outcome carries a short summary', () => {
  for (const outcome of ['approved', 'changes_requested', 'rejected'] as const) {
    const message = buildReviewNotification({ ...base, outcome });
    assert.ok(message.summary.length > 0 && message.summary.length < 120, message.summary);
    assert.ok(message.subject.length > 0);
    assert.ok(message.text.length > 0);
  }
});

test('shouldNotify only accepts an account-linked submission with an email', () => {
  assert.equal(shouldNotify({ userId: 'u1', email: 'a@example.com' }), true);
  // A guest submission has no account and no stored address.
  assert.equal(shouldNotify({ userId: null, email: 'a@example.com' }), false);
  assert.equal(shouldNotify({ userId: 'u1', email: null }), false);
  assert.equal(shouldNotify({}), false);
});
