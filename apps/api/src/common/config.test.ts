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
  });
  assert.deepEqual(problems, []);
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
