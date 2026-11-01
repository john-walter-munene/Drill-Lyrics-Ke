import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAccountDeletedEmail,
  buildEmailConfirmationEmail,
  buildPasswordResetEmail,
  EMAIL_CONFIRMATION_TTL_DAYS,
  PASSWORD_RESET_TTL_MINUTES,
} from './account-emails.ts';

const RESET_URL = 'https://drillke.com/reset-password/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

test('the reset email carries the link and the expiry', () => {
  const mail = buildPasswordResetEmail({
    displayName: 'Wanjiku',
    resetUrl: RESET_URL,
    siteUrl: 'https://drillke.com',
  });
  assert.equal(mail.subject, 'Reset your DrillKe password');
  assert.ok(mail.text.includes(RESET_URL));
  assert.ok(mail.text.includes('Wanjiku'));
  assert.ok(mail.text.includes(`${PASSWORD_RESET_TTL_MINUTES} minutes`));
});

test('the reset email never contains a password or a hash', () => {
  const mail = buildPasswordResetEmail({ displayName: 'Wanjiku', resetUrl: RESET_URL, siteUrl: 'https://drillke.com' });
  const lower = mail.text.toLowerCase();
  for (const forbidden of ['scrypt$', 'passwordhash', 'your password is', 'temporary password']) {
    assert.ok(!lower.includes(forbidden), `must not mention ${forbidden}`);
  }
});

test('the reset email tells a non-requester that nothing changed', () => {
  const mail = buildPasswordResetEmail({ displayName: 'Wanjiku', resetUrl: RESET_URL, siteUrl: 'https://drillke.com' });
  // The phishing-resistance rule: a forwarded or misdelivered link must not
  // look urgent, and must say ignoring it is safe.
  assert.ok(/did not ask/i.test(mail.text));
  assert.ok(/ignore this message/i.test(mail.text));
  assert.ok(/still works/i.test(mail.text));
});

test('a missing display name still reads as a greeting, not "Hi ,"', () => {
  const mail = buildPasswordResetEmail({ displayName: '   ', resetUrl: RESET_URL, siteUrl: 'https://drillke.com' });
  assert.ok(mail.text.startsWith('Hi there,'));
});

test('the reset TTL is configurable per call but defaults consistently', () => {
  const custom = buildPasswordResetEmail({ displayName: 'A', resetUrl: RESET_URL, siteUrl: 'https://x', ttlMinutes: 15 });
  assert.ok(custom.text.includes('15 minutes'));
  assert.equal(PASSWORD_RESET_TTL_MINUTES, 60);
});

test('the deletion email explains exactly what is kept', () => {
  const mail = buildAccountDeletedEmail({ displayName: 'Otieno', siteUrl: 'https://drillke.com', creditedContributions: 3 });
  assert.ok(mail.text.includes('delete'));
  // Honest about retention — the promise `product.md` principle 4 demands.
  assert.ok(/published lyrics you contributed stay on the site/i.test(mail.text));
  assert.ok(mail.text.includes('3 songs'));
  assert.ok(/signed out everywhere/i.test(mail.text));
});

test('the deletion email handles zero credited contributions', () => {
  const mail = buildAccountDeletedEmail({ displayName: 'Otieno', siteUrl: 'https://drillke.com', creditedContributions: 0 });
  assert.ok(/nothing with your name remains/i.test(mail.text));
  assert.ok(!mail.text.includes('0 songs'));
});

test('one credited contribution is singular', () => {
  const mail = buildAccountDeletedEmail({ displayName: 'O', siteUrl: 'https://x', creditedContributions: 1 });
  assert.ok(!mail.text.includes('1 songs'), 'pluralisation must not leak into user-facing mail');
});

test('the confirmation email carries the link, the expiry and the "you can still use it" rule', () => {
  const mail = buildEmailConfirmationEmail({
    displayName: 'Achieng',
    confirmUrl: 'https://drillke.com/confirm-email/abc123',
    siteUrl: 'https://drillke.com',
  });
  assert.equal(mail.subject, 'Confirm your DrillKe email');
  assert.ok(mail.text.includes('https://drillke.com/confirm-email/abc123'));
  assert.ok(mail.text.includes(`${EMAIL_CONFIRMATION_TTL_DAYS} days`));
  // v1 does not gate on confirmation; promising otherwise would be a lie.
  assert.ok(/keep browsing and submitting lyrics without confirming/i.test(mail.text));
  assert.ok(/works once/i.test(mail.text));
});

test('the confirmation email handles an unknown sign-up', () => {
  const mail = buildEmailConfirmationEmail({
    displayName: 'Achieng',
    confirmUrl: 'https://x/confirm-email/abc',
    siteUrl: 'https://x',
  });
  assert.ok(/did not create an account/i.test(mail.text));
  assert.ok(/nothing will happen/i.test(mail.text));
});

test('the confirmation email carries the link and a 7-day window', () => {
  const confirmUrl = 'https://drillke.com/confirm-email/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  const mail = buildEmailConfirmationEmail({ displayName: 'Achieng', confirmUrl, siteUrl: 'https://drillke.com' });
  assert.equal(mail.subject, 'Confirm your DrillKe email');
  assert.ok(mail.text.includes(confirmUrl));
  assert.ok(mail.text.includes('Achieng'));
  assert.ok(mail.text.includes(`${EMAIL_CONFIRMATION_TTL_DAYS} days`));
});

test('the confirmation email does not gate features the product leaves open', () => {
  const mail = buildEmailConfirmationEmail({
    displayName: 'A',
    confirmUrl: 'https://x/confirm-email/' + 'a'.repeat(43),
    siteUrl: 'https://x',
  });
  // v1 lets an unconfirmed account browse and submit; the mail must not claim
  // otherwise, or a user who never confirms will think they are locked out.
  assert.ok(/keep browsing and submitting/i.test(mail.text));
  assert.ok(/ignore this message and nothing will happen/i.test(mail.text));
});

test('the confirmation email never contains a password or token hash', () => {
  const mail = buildEmailConfirmationEmail({
    displayName: 'A',
    confirmUrl: 'https://x/confirm-email/' + 'a'.repeat(43),
    siteUrl: 'https://x',
  });
  assert.ok(!mail.text.toLowerCase().includes('scrypt'));
  assert.ok(!mail.text.toLowerCase().includes('password'));
});
