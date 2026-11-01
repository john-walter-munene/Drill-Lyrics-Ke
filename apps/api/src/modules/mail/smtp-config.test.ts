import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSmtpPort, resolveSmtpSettings } from './smtp-config.ts';

/** A minimal valid environment; each test overrides what it is about. */
const VALID = {
  SMTP_HOST: 'smtp.postmarkapp.com',
  SMTP_PORT: '587',
  MAIL_FROM: 'DrillKe <no-reply@drillke.com>',
} as NodeJS.ProcessEnv;

test('a complete environment resolves', () => {
  const result = resolveSmtpSettings(VALID);
  assert.equal(result.problems.length, 0);
  assert.ok(result.settings);
  assert.equal(result.settings.host, 'smtp.postmarkapp.com');
  assert.equal(result.settings.port, 587);
  assert.equal(result.settings.secure, false, '587 negotiates STARTTLS, it is not implicit TLS');
  assert.equal(result.settings.allowInvalidCert, false);
});

test('port 465 implies implicit TLS and an explicit SMTP_SECURE wins', () => {
  assert.equal(resolveSmtpSettings({ ...VALID, SMTP_PORT: '465' }).settings?.secure, true);
  assert.equal(resolveSmtpSettings({ ...VALID, SMTP_SECURE: 'true' }).settings?.secure, true);
  assert.equal(resolveSmtpSettings({ ...VALID, SMTP_PORT: '465', SMTP_SECURE: 'false' }).settings?.secure, false);
});

test('an omitted port defaults to 587 rather than failing', () => {
  const result = resolveSmtpSettings({ ...VALID, SMTP_PORT: undefined });
  assert.equal(result.problems.length, 0);
  assert.equal(result.settings?.port, 587);
});

test('parseSmtpPort rejects anything that is not a TCP port', () => {
  assert.equal(parseSmtpPort(undefined), 587);
  assert.equal(parseSmtpPort(''), 587);
  assert.equal(parseSmtpPort(' 25 '), 25);
  for (const bad of ['0', '-1', '65536', 'abc', '58.7', '']) {
    if (bad === '') continue;
    assert.equal(parseSmtpPort(bad), null, bad);
  }
});

test('every missing or malformed field is reported, not just the first', () => {
  // Empty env: host and sender are missing; the port correctly defaults, so it
  // is not a problem. What matters is that the operator sees *both* gaps at
  // once instead of fixing one, redeploying, and being told about the next.
  const result = resolveSmtpSettings({} as NodeJS.ProcessEnv);
  const joined = result.problems.join(' ');
  assert.match(joined, /SMTP_HOST/);
  assert.match(joined, /MAIL_FROM/);
  assert.ok(result.problems.length >= 2, result.problems.join('; '));
});

test('MAIL_FROM must contain an address', () => {
  const result = resolveSmtpSettings({ ...VALID, MAIL_FROM: 'DrillKe' });
  assert.match(result.problems.join(' '), /MAIL_FROM does not look like an address/);
});

test('credentials are all-or-nothing', () => {
  const userOnly = resolveSmtpSettings({ ...VALID, SMTP_USER: 'apikey' });
  assert.match(userOnly.problems.join(' '), /SMTP_PASSWORD is required when SMTP_USER is set/);

  const passwordOnly = resolveSmtpSettings({ ...VALID, SMTP_PASSWORD: 'secret' });
  assert.match(passwordOnly.problems.join(' '), /SMTP_USER is required when SMTP_PASSWORD is set/);

  const both = resolveSmtpSettings({ ...VALID, SMTP_USER: 'apikey', SMTP_PASSWORD: 'secret' });
  assert.equal(both.problems.length, 0);
  assert.equal(both.settings?.user, 'apikey');
  assert.equal(both.settings?.password, 'secret');
});

test('no credentials means no auth object, not empty auth', () => {
  // Sending `auth: { user: '', pass: undefined }` makes some providers reject
  // the connection, so the settings must omit the fields entirely.
  const result = resolveSmtpSettings(VALID);
  assert.equal(result.settings?.user, undefined);
  assert.equal(result.settings?.password, undefined);
});

test('SMTP_ALLOW_INVALID_CERT is opt-in', () => {
  assert.equal(resolveSmtpSettings(VALID).settings?.allowInvalidCert, false);
  assert.equal(resolveSmtpSettings({ ...VALID, SMTP_ALLOW_INVALID_CERT: 'true' }).settings?.allowInvalidCert, true);
  assert.equal(resolveSmtpSettings({ ...VALID, SMTP_ALLOW_INVALID_CERT: '1' }).settings?.allowInvalidCert, false);
});
