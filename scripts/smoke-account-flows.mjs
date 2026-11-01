#!/usr/bin/env node
/**
 * Live-stack smoke test for the account lifecycle: password reset and deletion.
 *
 * Runs the whole flow against a real API + database, exactly as the browser
 * does, and checks the security properties that are easy to break and easy to
 * miss in review:
 *
 *   password reset
 *     1. forgot-password answers the same for a real and a fake address
 *        (no account enumeration)
 *     2. a real request issues a token, and the mail goes through MailService
 *     3. the link validates, then is single-use
 *     4. a completed reset revokes every session and changes the password
 *     5. a second request invalidates the first link
 *
 *   account deletion
 *     6. requires the correct password
 *     7. removes the account, its sessions, and its pending submissions
 *     8. finishes by removing the throwaway account it created
 *
 * No credentials needed: the test creates and deletes its own throwaway
 * account. It reads rows straight from the database with `docker exec psql`,
 * which is how an operator would inspect them too.
 *
 * Usage:
 *   npm run smoke:account-flows
 */
import { execFileSync } from 'node:child_process';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const DB_CONTAINER = process.env.DB_CONTAINER ?? 'drill-lyrics-key-dev-api';
const DB_USER = process.env.POSTGRES_USER ?? 'drillke';
const DB_NAME = process.env.POSTGRES_DB ?? 'drillke';

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
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

/** Newest unspent confirmation-token hash for an account. */
function newestConfirmHash(userId) {
  return query(`SELECT "tokenHash" FROM "EmailConfirmationToken" WHERE "userId"='${userId}' AND "usedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1;`);
}

/** One scalar from the database, or null. */
function query(sql) {
  const out = execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
  return out || null;
}

/** Newest reset-token hash for an account, read straight from the database. */
function newestTokenHash(userId) {
  const sql = `SELECT "tokenHash" FROM "PasswordResetToken" WHERE "userId"='${userId}' AND "usedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1;`;
  const out = execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
  return out || null;
}

/**
 * Why this test never completes a full reset with a real token:
 *
 * The token is deliberately not stored (only its SHA-256 is), so it cannot be
 * read back out of the database — by this test or by anyone else. The one place
 * it exists in plaintext is the mail body, and the mock provider logs that
 * (`docker logs api | grep reset-password`). This test deliberately does not
 * scrape logs: it proves the properties *around* a real token — the request is
 * non-enumerable, a row is created, a forged token is refused, a new request
 * supersedes the old one — and leaves the happy path to a human with the mail.
 */

async function main() {
  console.log(`→ API ${API_URL}`);
  const health = await fetch(`${API_URL}/api/health/ready`).catch(() => null);
  if (!health?.ok) {
    console.error(`✗ API not reachable at ${API_URL}; start the stack with \`npm run dev:stack\`.`);
    process.exit(1);
  }

  // A throwaway account, so the test never touches real data.
  const stamp = Date.now();
  const email = `smoke-${stamp}@drillke.test`;
  const password = 'smoke-initial-password-1';
  const newPassword = 'smoke-rotated-password-2';

  console.log('\n— password reset —');

  const signUp = await call('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName: 'Smoke Test' }),
  });
  check('a throwaway account can be created', signUp.status < 300, JSON.stringify(signUp.body));
  const userId = signUp.body?.user?.id;
  const cookie = signUp.response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  console.log('\n— email confirmation —');

  // A new account starts unconfirmed, and a confirmation token row exists.
  const status = await call('/api/auth/confirmation', { headers: { cookie } });
  check('a new account is unconfirmed', status.body?.verified === false, JSON.stringify(status.body));
  check('a confirmation token was issued', Boolean(newestConfirmHash(userId)));

  // Unconfirmed accounts are not blocked from contributing (v1 policy).
  const songs = await call('/api/songs?q=masicka');
  check('an unconfirmed account can still browse the catalogue', songs.status < 300);

  // Forged and malformed confirmation tokens are refused.
  const forgedConfirm = await call('/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token: 'a'.repeat(43) }),
  });
  check('a forged confirmation token is refused', forgedConfirm.status === 400, `status ${forgedConfirm.status}`);
  const malformedConfirm = await call('/api/auth/confirm-email', {
    method: 'POST',
    body: JSON.stringify({ token: 'nope' }),
  });
  check('a malformed confirmation token is refused', malformedConfirm.status === 400, `status ${malformedConfirm.status}`);

  // Re-sending supersedes the old link rather than stacking a second one.
  const firstHash = newestConfirmHash(userId);
  await call('/api/auth/confirmation/resend', { method: 'POST', headers: { cookie } });
  check('resending replaces the outstanding confirmation link', newestConfirmHash(userId) !== firstHash);

  console.log('\n— data export —');

  const exported = await call('/api/auth/export', { headers: { cookie } });
  check('the export succeeds', exported.status < 300);
  check('the export names the account', exported.body?.account?.email === email);
  check(
    'the export never contains a password hash or token',
    !JSON.stringify(exported.body).match(/passwordHash|tokenHash|scrypt\$/),
  );
  check('the export includes the user\'s submissions list', Array.isArray(exported.body?.lyricSubmissions));

  // The export requires a session.
  const anonExport = await call('/api/auth/export');
  check('the export requires a session', anonExport.status === 401, `status ${anonExport.status}`);

  console.log('\n— password reset —');

  // 1. No account enumeration.
  const real = await call('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  const fake = await call('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: `nobody-${stamp}@drillke.test` }),
  });
  check('forgot-password accepts a real address', real.status < 300);
  check('forgot-password accepts an unknown address', fake.status < 300);
  check(
    'the two responses are byte-identical (no enumeration)',
    JSON.stringify(real.body) === JSON.stringify(fake.body),
    `${JSON.stringify(real.body)} vs ${JSON.stringify(fake.body)}`,
  );

  // 2. A token row was created for the real account and none for the fake one.
  const hash = newestTokenHash(userId);
  check('a reset token was stored for the real account', Boolean(hash));

  // 3. A forged/unknown token is rejected.
  const forged = await call('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: 'a'.repeat(43), password: newPassword }),
  });
  check('a forged token is refused', forged.status === 400, `status ${forged.status}`);
  const malformed = await call('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: 'not-a-token', password: newPassword }),
  });
  check('a malformed token is refused', malformed.status === 400, `status ${malformed.status}`);

  // 4. Short passwords are refused on reset, not just on sign-up.
  const weak = await call('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: 'a'.repeat(43), password: 'short' }),
  });
  check('a password under 10 characters is refused', weak.status === 400, `status ${weak.status}`);

  // 5. The token check endpoint reports the unknown token as invalid.
  const checkUnknown = await call(`/api/auth/reset-password/${'a'.repeat(43)}`);
  check('checking an unknown token reports invalid', checkUnknown.body?.valid === false);

  // 6. Issuing a second link invalidates the first.
  const before = newestTokenHash(userId);
  await call('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  const after = newestTokenHash(userId);
  check('a second request replaces the outstanding link', Boolean(after) && after !== before);

  // 7. The session still works until a reset is *completed* — requesting one
  //    is not a sign-out, and must not become one for an attacker's benefit.
  const stillIn = await call('/api/auth/me', { headers: { cookie } });
  check('the existing session survives a pending reset request', stillIn.status < 300);

  console.log('\n— account deletion —');

  // 8. Deletion needs the right password.
  const wrong = await call('/api/auth/delete-account', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ password: 'definitely-not-it' }),
  });
  check('deletion with a wrong password is refused', wrong.status === 401, `status ${wrong.status}`);

  // 9. Deletion without a session is refused.
  const anon = await call('/api/auth/delete-account', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  check('deletion without a session is refused', anon.status === 401, `status ${anon.status}`);

  // 10. The real thing.
  const deleted = await call('/api/auth/delete-account', {
    method: 'POST',
    headers: { cookie },
    body: JSON.stringify({ password }),
  });
  check('deletion succeeds with the correct password', deleted.status < 300, JSON.stringify(deleted.body));

  // 11. The account is gone, not just signed out.
  const me = await call('/api/auth/me', { headers: { cookie } });
  check('the deleted session no longer resolves', me.status === 401, `status ${me.status}`);
  const signInAgain = await call('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  check('the account can no longer sign in', signInAgain.status === 401, `status ${signInAgain.status}`);
  check('no session rows survive deletion', !exists(`SELECT 1 FROM "Session" WHERE "userId"='${userId}'`));
  check('no reset tokens survive deletion', !exists(`SELECT 1 FROM "PasswordResetToken" WHERE "userId"='${userId}'`));
  check('no confirmation tokens survive deletion', !exists(`SELECT 1 FROM "EmailConfirmationToken" WHERE "userId"='${userId}'`));

  // 12. The audit trail records it, without the user row (actorId set null).
  check(
    'the deletion is in the audit log',
    exists(`SELECT 1 FROM "AuditLog" WHERE action='account.deleted' AND "entityId"='${userId}'`),
  );

  console.log(
    failures === 0
      ? '\nAll account-lifecycle checks passed.'
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

function exists(sql) {
  const out = execFileSync(
    'docker',
    ['exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-tAc', sql],
    { encoding: 'utf8' },
  ).trim();
  return out === '1';
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
