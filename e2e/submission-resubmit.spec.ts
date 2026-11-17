import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Throwaway accounts made by this file, deleted afterwards through the real
 * self-service deletion route. Without this the suite leaks an account per run,
 * which is exactly the kind of mess a test should not leave in a shared stack.
 */
const throwawayAccounts: { email: string; password: string }[] = [];

test.afterAll(async ({ request }) => {
  for (const account of throwawayAccounts) {
    const session = await signIn(request, account.email, account.password);
    if (!session) continue;
    await request.post(`${API_URL}/api/auth/delete-account`, {
      headers: { cookie: session.jar },
      data: { password: account.password },
    });
  }
  throwawayAccounts.length = 0;
});

/**
 * The contribution loop, closed.
 *
 * A reviewer requests changes; the contributor must be able to act on that note.
 * Before the resubmit route existed the note was readable and unactionable: the
 * only write path started a brand-new submission and lost the conversation.
 *
 * This drives the real API: submit → request changes → resubmit → the queue
 * shows the corrected text, on the same submission id.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4100';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-now';

type Session = { jar: string };

/** Sign in and return the cookie header, so requests share one session. */
async function signIn(request: APIRequestContext, email: string, password: string): Promise<Session | null> {
  const res = await request.post(`${API_URL}/api/auth/signin`, { data: { email, password } });
  if (!res.ok()) return null;
  const cookies = res.headers()['set-cookie'];
  if (!cookies) return null;
  const cookie = cookies.split('\n').map((line) => line.split(';')[0]).join('; ');
  return { jar: cookie };
}

/** A throwaway account, so the test never touches a real contributor's data. */
async function createContributor(request: APIRequestContext): Promise<{ id: string; email: string; password: string }> {
  const email = `resubmit-${Date.now()}@example.test`;
  const password = 'test-password-123';
  const res = await request.post(`${API_URL}/api/auth/signup`, {
    data: { email, password, displayName: 'Resubmit Test' },
  });
  expect(res.ok(), 'sign-up should succeed for a throwaway account').toBe(true);
  const body = await res.json() as { user?: { id: string } };
  throwawayAccounts.push({ email, password });
  return { id: body.user?.id ?? '', email, password };
}

test('a contributor can act on "changes requested" and the queue sees the fix', async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  const catalogue = await (await request.get(`${API_URL}/api/songs`)).json() as { items: { id: string }[] };
  test.skip(!catalogue.items.length, 'No published songs; nothing to submit against.');
  const songId = catalogue.items[0]!.id;

  const contributor = await createContributor(request);
  const session = await signIn(request, contributor.email, contributor.password);
  test.skip(!session, 'Sign-up did not produce a session; check the auth config.');

  // 1. Submit.
  const original = '[00:00.000] Original first line\n[00:04.000] Original second line';
  const created = await request.post(`${API_URL}/api/lyrics/submissions`, {
    headers: { cookie: session!.jar },
    data: { songId, markdown: original },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json() as { id: string };

  // 2. A moderator requests changes with a reason.
  const admin = await signIn(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  test.skip(!admin, 'The seeded admin cannot sign in; skipping the review half.');
  const review = await request.post(`${API_URL}/api/admin/lyrics/${id}/request-changes`, {
    headers: { cookie: admin!.jar },
    data: { note: 'Line 2 timestamp is wrong. Fix it and resend.' },
  });
  expect(review.ok(), 'request-changes should succeed').toBe(true);

  // 3. The contributor sees the note in their own history — the row is actionable.
  const mine = await (await request.get(`${API_URL}/api/lyrics/submissions/mine`, {
    headers: { cookie: session!.jar },
  })).json() as { items: { id: string; status: string; reviewNote: string | null; markdown: string }[] };
  const row = mine.items.find((item) => item.id === id);
  expect(row, 'the submission appears in the contributor\'s history').toBeTruthy();
  expect(row!.status).toBe('changes_requested');
  expect(row!.reviewNote).toContain('timestamp');
  // The text is returned, so the editor can prefill instead of making them retype.
  expect(row!.markdown).toBe(original);

  // 4. Resubmit the corrected text.
  const corrected = '[00:00.000] Original first line\n[00:07.500] Corrected second line';
  const resubmitted = await request.put(`${API_URL}/api/lyrics/submissions/${id}`, {
    headers: { cookie: session!.jar },
    data: { markdown: corrected, note: 'Fixed the second timestamp.' },
  });
  expect(resubmitted.ok(), 'resubmit should succeed').toBe(true);
  const body = await resubmitted.json() as { id: string; status: string };
  expect(body.id, 'the same submission is edited, not duplicated').toBe(id);
  expect(body.status).toBe('pending');

  // 5. The moderator's queue now shows the corrected text.
  const queue = await (await request.get(`${API_URL}/api/admin/lyrics/queue?status=pending`, {
    headers: { cookie: admin!.jar },
  })).json() as { items: { id: string }[] };
  expect(queue.items.some((item) => item.id === id), 'the corrected row is back in the queue').toBe(true);

  // 6. The stale note is gone: it described text that no longer exists.
  const after = await (await request.get(`${API_URL}/api/lyrics/submissions/${id}`, {
    headers: { cookie: session!.jar },
  })).json() as { status: string; reviewNote: string | null; markdown: string };
  expect(after.markdown).toBe(corrected);
  expect(after.reviewNote, 'the old note must not linger on a pending row').toBeNull();
});

test('a submission that is pending cannot be resubmitted', async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  const catalogue = await (await request.get(`${API_URL}/api/songs`)).json() as { items: { id: string }[] };
  test.skip(!catalogue.items.length, 'No published songs; nothing to submit against.');

  const contributor = await createContributor(request);
  const session = await signIn(request, contributor.email, contributor.password);
  test.skip(!session, 'Sign-up did not produce a session; check the auth config.');

  const created = await request.post(`${API_URL}/api/lyrics/submissions`, {
    headers: { cookie: session!.jar },
    data: { songId: catalogue.items[0]!.id, markdown: '[00:00.000] Only line' },
  });
  const { id } = await created.json() as { id: string };

  const res = await request.put(`${API_URL}/api/lyrics/submissions/${id}`, {
    headers: { cookie: session!.jar },
    data: { markdown: '[00:00.000] Rewritten while still pending' },
  });
  expect(res.status(), 'a pending submission has nothing to act on').toBe(409);
});

test('another user cannot resubmit, and cannot tell the row exists', async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  const catalogue = await (await request.get(`${API_URL}/api/songs`)).json() as { items: { id: string }[] };
  test.skip(!catalogue.items.length, 'No published songs; nothing to submit against.');

  const owner = await createContributor(request);
  const ownerSession = await signIn(request, owner.email, owner.password);
  test.skip(!ownerSession, 'Sign-up did not produce a session; check the auth config.');
  const created = await request.post(`${API_URL}/api/lyrics/submissions`, {
    headers: { cookie: ownerSession!.jar },
    data: { songId: catalogue.items[0]!.id, markdown: '[00:00.000] Owner line' },
  });
  const { id } = await created.json() as { id: string };

  const intruder = await createContributor(request);
  const intruderSession = await signIn(request, intruder.email, intruder.password);
  test.skip(!intruderSession, 'Sign-up did not produce a session; check the auth config.');

  const res = await request.put(`${API_URL}/api/lyrics/submissions/${id}`, {
    headers: { cookie: intruderSession!.jar },
    data: { markdown: '[00:00.000] Someone else\'s text' },
  });
  // 404, not 403: the response must not confirm that the id exists.
  expect(res.status()).toBe(404);
});

test('a signed-out caller cannot resubmit', async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health/ready`);
  test.skip(!health.ok(), `API not reachable at ${API_URL}; start the stack.`);

  const res = await request.put(`${API_URL}/api/lyrics/submissions/any-id`, {
    data: { markdown: '[00:00.000] Anonymous edit' },
  });
  expect(res.status()).toBe(401);
});