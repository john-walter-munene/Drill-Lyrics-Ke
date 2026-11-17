import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkResubmission,
  humanStatus,
  isResubmittable,
  resubmissionUpdate,
} from '../../../../packages/shared/src/submissions.ts';

/**
 * The rule that lets a contributor act on "changes requested".
 *
 * Before this existed the reviewer's note was readable and unactionable: the
 * only write route started a new submission. These cases pin down who may
 * resubmit and what the row looks like afterwards.
 */

const owner = { userId: 'user-1', ownerId: 'user-1' };

test('a contributor can resubmit when changes were requested', () => {
  assert.deepEqual(checkResubmission({ ...owner, status: 'changes_requested' }), { ok: true });
});

test('a draft can be completed by its owner', () => {
  assert.deepEqual(checkResubmission({ ...owner, status: 'draft' }), { ok: true });
});

test('a rejected submission is terminal', () => {
  const result = checkResubmission({ ...owner, status: 'rejected' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'wrong_status');
  assert.match(result.message, /rejected/);
});

test('a published submission cannot be resubmitted over itself', () => {
  const result = checkResubmission({ ...owner, status: 'published' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'wrong_status');
});

test('a submission already pending cannot be resubmitted', () => {
  const result = checkResubmission({ ...owner, status: 'pending' });
  assert.equal(result.ok, false);
});

test('another user cannot resubmit, and is told nothing about the row', () => {
  const result = checkResubmission({ userId: 'user-2', ownerId: 'user-1', status: 'changes_requested' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'not_owner');
  // Ownership is decided before status, so this message must not reveal the
  // state the row is actually in.
  assert.equal(result.message, 'Submission not found');
  assert.doesNotMatch(result.message, /changes/);
});

test('a guest-owned submission has no owner to prove, so it is never resubmittable', () => {
  const result = checkResubmission({ userId: 'user-1', ownerId: null, status: 'changes_requested' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'not_owner');
});

test('a signed-out caller cannot resubmit', () => {
  const result = checkResubmission({ userId: undefined, ownerId: 'user-1', status: 'changes_requested' });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'not_owner');
  assert.equal(result.message, 'Sign in to edit your submission');
});

test('resubmitting clears the review fields, because the note described old text', () => {
  assert.deepEqual(resubmissionUpdate('changes_requested'), {
    status: 'pending',
    reviewNote: null,
    reviewerId: null,
    reviewedAt: null,
  });
});

test('resubmissionUpdate refuses a status the rule says is terminal', () => {
  // Belt and braces: the API checks eligibility first, but the updater must not
  // be able to resurrect a published or rejected row if it were called directly.
  assert.throws(() => resubmissionUpdate('rejected'), /rejected/);
  assert.throws(() => resubmissionUpdate('published'), /published/);
});

test('the resubmittable set matches the eligibility rule', () => {
  assert.equal(isResubmittable('changes_requested'), true);
  assert.equal(isResubmittable('draft'), true);
  for (const status of ['pending', 'approved', 'published', 'rejected', 'unpublished']) {
    assert.equal(isResubmittable(status), false, `${status} must not be resubmittable`);
  }
});

test('statuses read as sentences, not snake_case identifiers', () => {
  assert.equal(humanStatus('changes_requested'), 'changes requested');
  assert.equal(humanStatus('pending'), 'pending');
});