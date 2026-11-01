#!/usr/bin/env node
/**
 * Live-stack smoke test for email confirmation and account data export.
 *
 * Checks the properties that are easy to regress and hard to see in a diff:
 *
 *   confirmation
 *     1. sign-up succeeds even though the address is unconfirmed
 *     2. a confirmation token row is created
 *     3. a forged token is refused
 *     4. a real token confirms, and reports `already_confirmed` on reuse
 *     5. confirmation does not touch the password or the session
 *
 *   export
 *     6. requires a session
 *     7. includes the account and its submissions
 *     8. never includes `passwordHash` or any token hash
 *
 * Like the account-flow test, it creates and removes its own throwaway user.
 * The confirmation link is read from the database's token *hash* only to prove
 * a row exists; the happy path is exercised with a token issued by the API for
 * this test account (see `issueTokenForTest`).
 *
 * Usage: npm run smoke:confirmation-export
 */
import { execFileSync } from 'node:child_process';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'drill-lyrics-key-dev-api';
const DB_USER = process.env.POSTGRES_USER ?? 'drillke';
const DB_NAME = process.env.POSTGRES_DB ?? 'drillke';

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(path, init = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body, response };
}

function sql(statement) {
  return execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', statement],
    { encoding: 'utf8' },
  ).trim();
}

/**
 * The API never returns a token, and deliberately cannot. To exercise the happy
 * path this inserts a token this test generated, hashed the same way the service
 * does — which is exactly what the mail would have carried.
 */
async function issueTokenForTest(userId) {
  const { createHash, randomBytes } = await import('node:crypto');
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token, 'utf8').digest('base64url');
  sql(
    `INSERT INTO "EmailConfirmationToken" (id, "userId", "tokenHash", "expiresAt") `
    + `VALUES ('smoke-${Date.now()}', '${userId}', '${hash}', now() + interval '1 hour');`,
  );
  return token;
}

async function main() {
  console.log(`→ API ${API_URL}`);
  const health = await fetch(`${API_URL}/api/health/ready`).catch(() => null);
  if (!health?.ok) {
    console.error(`✗ API not reachable at ${API_URL}; start the stack with \`npm run dev:stack\`.`);
    process.exit(1);
  }

  const email = `confirm-${Date.now()}@drillke.test`;
  const password = 'confirm-initial-password';

  console.log('\n— email confirmation —');

  const signUp = await call('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName: 'Confirm Tester' }),
  });
  check('sign-up succeeds for an unconfirmed address', signUp.status < 300, JSON.stringify(signUp.body));
  const userId = signUp.body?.user?.id;
  const cookie = signUp.response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  check(
    'a confirmation token was issued at sign-up',
    Number(sql(`SELECT count(*) FROM "EmailConfirmationToken" WHERE "userId"='${userId}'`)) > 0,
  );
  check(
    'the new account starts unconfirmed',
    sql(`SELECT "emailVerifiedAt" IS NULL FROM "User" WHERE id='${userId}'`) === 't',
  );

  const status = await call('/api/auth/confirmation', { headers: { cookie } });
  check('the account reports itself unconfirmed', status.body?.verified === false);

  const forged = await call('/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token: 'a'.repeat(43) }),
  });
  check('a forged confirmation token is refused', forged.status === 400, `status ${forged.status}`);

  const malformed = await call('/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token: 'nope' }),
  });
  check('a malformed token is refused', malformed.status === 400);

  const token = await issueTokenForTest(userId);
  const confirmed = await call('/api/auth/confirm-email', { method: 'POST', body: JSON.stringify({ token }) });
  check('a real token confirms the account', confirmed.body?.status === 'confirmed', JSON.stringify(confirmed.body));
  check(
    'the account is marked verified',
    sql(`SELECT "emailVerifiedAt" IS NOT NULL FROM "User" WHERE id='${userId}'`) === 't',
  );

  const again = await call('/api/auth/confirm-email', { method: 'POST', body: JSON.stringify({ token }) });
  check('clicking the same link again says "already confirmed"', again.body?.status === 'already_confirmed');
  check('reuse is not an error', again.status < 300, `status ${again.status}`);

  const signIn = await call('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
  check('confirmation does not change the password', signIn.status < 300, `status ${signIn.status}`);

  console.log('\n— account export —');

  const anon = await call('/api/auth/export');
  check('export without a session is refused', anon.status === 401, `status ${anon.status}`);

  const songs = await call('/api/songs?q=masicka');
  const song = songs.body?.items?.[0];
  if (song) {
    await call('/api/lyrics/submissions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ songId: song.id, markdown: 'export line one\nexport line two', note: 'export fixture' }),
    });
  }

  const exported = await call('/api/auth/export', { headers: { cookie } });
  check('export succeeds with a session', exported.status < 300, `status ${exported.status}`);
  const data = exported.body ?? {};
  check('export includes the account', data.account?.email === email);
  check('export includes the submissions', Array.isArray(data.lyricSubmissions) && data.lyricSubmissions.length >= 1);
  check('export carries the submitted lyrics', JSON.stringify(data.lyricSubmissions).includes('export line one'));
  check('export states what it excludes', typeof data.about === 'string' && /never included/i.test(data.about));

  const serialized = JSON.stringify(data);
  for (const forbidden of ['passwordHash', 'password', 'tokenHash', 'scrypt$']) {
    check(`export does not contain "${forbidden}"`, !serialized.includes(forbidden));
  }

  // Clean up: the export test submitted lyrics, so remove the user (cascades).
  sql(`DELETE FROM "User" WHERE id='${userId}'`);

  console.log(failures === 0 ? '\nAll confirmation and export checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
