import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectConfigProblems,
  MIN_SECRET_LENGTH,
} from './config.ts';

const strong = 'a'.repeat(MIN_SECRET_LENGTH);

test('a complete, strong environment has no problems', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://drillke:drillke@localhost:5432/drillke',
    JWT_SECRET: strong,
    // Pinned: without this the result depends on the machine's MAIL_PROVIDER,
    // so the test would pass locally and fail on a deploy that sets `smtp`.
    MAIL_PROVIDER: 'mock',
  });
  assert.deepEqual(problems, []);
});

test('MAIL_PROVIDER=smtp adds the SMTP problems to the list', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: strong,
    MAIL_PROVIDER: 'smtp',
  });
  assert.ok(problems.some((p) => p.includes('SMTP_HOST')), problems.join('; '));
});

test('a complete SMTP configuration adds no problems', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: strong,
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.postmarkapp.com',
    SMTP_PORT: '587',
    MAIL_FROM: 'DrillKe <no-reply@drillke.com>',
  });
  assert.deepEqual(problems, []);
});

test('an unknown MAIL_PROVIDER is rejected rather than silently treated as mock', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: strong,
    MAIL_PROVIDER: 'sendmail',
  });
  assert.ok(problems.some((p) => p.includes('MAIL_PROVIDER must be')), problems.join('; '));
});

test('DATABASE_URL is required', () => {
  const problems = collectConfigProblems({ JWT_SECRET: strong });
  assert.ok(problems.some((p) => p.startsWith('DATABASE_URL')));
});

test('default/example secrets are rejected', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: 'change-me-in-prod',
  });
  assert.ok(problems.some((p) => p.includes('default/example')));
});

test('short secrets are rejected', () => {
  const problems = collectConfigProblems({
    DATABASE_URL: 'postgresql://x',
    JWT_SECRET: 'too-short',
  });
  assert.ok(problems.some((p) => p.includes('too weak')));
});
