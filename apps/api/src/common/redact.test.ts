import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactEmail } from './redact.ts';

test('redactEmail keeps the domain and masks the local part', () => {
  assert.equal(redactEmail('someone@example.com'), 's***@example.com');
  assert.equal(redactEmail('a@b.co'), 'a***@b.co');
});

test('redactEmail never leaks a malformed address', () => {
  assert.equal(redactEmail('not-an-address'), '***');
  assert.equal(redactEmail('@example.com'), '***');
  assert.equal(redactEmail(''), '***');
});
