# DrillKe — Roadmap

Phases are goals with exit criteria, not dates. A phase does not start until the
previous one's exit criteria are met **in production**, not on a branch.

Scope for the current phase is fixed by [`product.md`](./product.md) §4.

---

## Phase 0 — Scaffold ✅ (this commit)

- [x] npm workspace monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [x] Prisma schema + baseline migration directory + seed
- [x] Docker: dev stack (hot reload) + production-shaped stack, two containers each
- [ ] CI workflow (lockfile, build, pure-logic tests) — **removed in `4c116fb`**; the scripts a
  pipeline needs (`npm ci`, `npm run build`, `npm test`) all pass locally, but nothing runs them
  on push yet
- [x] Docs: product, architecture, roadmap, lyrics format, API, deploy
- [x] `npm install` and first green `npm run build` on a developer machine

**Exit:** `npm run dev:stack` serves the web app at `:3000` and the API at
`:4000`, with `/api/health/ready` green (API + database).

## Phase 1 — The player (v1 core)

The only phase that matters for market entry.

- [x] Lyrics parser in `packages/shared` + parser tests (timestamps, ordering, edge cases)
- [x] `GET /api/songs` and `GET /api/songs/:slug` + `GET /api/songs/:slug/lyrics`
- [x] Persistent YouTube IFrame API player + shared playback clock
- [x] Active-line highlight, auto-scroll, click-to-seek, lyric previous/next, `aria-current`
- [x] Same-player queue handoff on track end (best effort; no gapless/crossfade guarantee)
- [x] `GET /api/artists` and artist catalogue reads
- [x] Guest text lyric submissions tied to a published catalogue song (pending only)
- [x] Verified-channel YouTube upload import into draft song candidates (requires `YOUTUBE_API_KEY`)
- [x] Unsynchronized fallback state (readable lyrics; no false timing/highlights)
- [x] Song page SSR + metadata + `MusicRecording` JSON-LD
- [x] Artist directory, profile pages and linked song catalogue
- [x] Public search by song title, artist, published lyric phrase, DJ, podcast and event
- [x] Display reviewed lyric annotations attached to published lyric lines
- [x] Moderator timing editor: play source, stamp lines from the shared player clock, save validated pending timings
- [x] Shared line-sync estimator (`packages/shared/src/lyric-sync.ts`): activity curve + event/offset/stretch search, callable from the admin editor
- [x] Moderator annotation editor: anchor Sheng/slang explanations to reviewed lines, validate with `resolveAnnotations`, publish with the version
- [ ] Build a 10-song validation catalogue with reviewed lyrics and timestamps

**Remaining Phase 1 work:** validate timed lyrics, annotations and the player on
real phones and tablets; reach the catalogue and synchronization targets below.
The first Masicka — Update lyrics contribution is in the pending review queue.
The current YouTube player handoff is same-player and best-effort, not guaranteed
gapless playback.

**Next, deliberately deferred (November 2026):** lyrics submission and
synchronization during playback. The acquisition side is stable enough to commit
to (a channel imports completely, resumes after a failure, and cannot be
double-walked), so the next pass starts from a catalogue that actually has songs
in review. Until then, `/submit` and the moderator timing editor are as described
above; no known blocking bug is outstanding on either.

The annotation editor has an end-to-end test (`e2e/annotation-editor.spec.ts`)
that drives the real review queue and asserts the annotation renders on the
public song page. It runs against a live stack (`npm run test:e2e`) and skips
itself, with a reason, when the stack or the seeded admin password is absent.

Known gaps in this phase, tracked rather than hidden:

- The estimator runs in the browser by default and offloads to the API for
weak devices, data-saver mode, long clips, or when the moderator asks. Only a
WAV upload reaches the API; the editor re-encodes on the client, so no other
codec is ever sent.
- Annotation authoring is enforced only by `resolveAnnotations` on the server;
the editor no longer adds a stricter client-side rule of its own.

**Exit:** 10 catalogue songs play with synced lyrics on a real phone, p75 first
play < 2.5 s, Lighthouse a11y ≥ 95.

## Phase 2 — Contribution & review

- [x] `POST /api/lyrics/submissions` (validated, throttled, anonymous or account-linked)
- [x] Upload a Markdown file + paste editor
- [x] `/admin` review queue: preview, approve, request changes, reject
- [x] `AuditLog` writes on review, artist intake, sync and role actions
- [x] Markdown import/export scripts (`content/`)
- [x] Notifications on review outcome (email, mock provider first)

**Exit:** a non-developer can submit lyrics and a reviewer can publish them
without touching Git. ≥ 50 published songs.

Implemented this phase:

- **Markdown authoring.** `parseLyricsDocument` / `serializeLyricsDocument` in
  `packages/shared/src/lyrics-markdown.ts` implement `lyrics-format.md` §1–§2:
  frontmatter with unknown-key rejection, line parsing through the existing
  parser, and the `## Annotations` section resolved with `resolveAnnotations`.
  The `/submit` form accepts either one-line-per-row text or a `.md` file/paste,
  validates it live, and warns when the document names a different song than the
  selected catalogue row.
- **Content scripts.** `npm run content:export` writes one Markdown file per
  published song to `content/<artist>/<song>.md`; `npm run content:import` turns
  changed files into **pending** submissions. Import is idempotent by
  `(artist, title, youtubeVideoId)` and never publishes — review stays the only
  route to publication. Both accept `--dry-run`.
- **Review notifications.** `buildReviewNotification` (shared, pure) produces the
  text for approved / changes-requested / rejected; `MailService` sends it. The
  mock provider is the default and logs the message, so the path works with no
  SMTP account. Delivery is attempted *after* the review transaction commits and
  can never fail the review; every outcome is recorded in the audit log as
  `lyrics.notification_sent|skipped|failed`.

Mail is real as of this pass. `MAIL_PROVIDER=smtp` runs a `nodemailer` transport
(SES, Postmark, Mailgun, MailHog) and `mock` remains the default: it logs the
message, so no contributor receives mail until a transport is configured. The
configuration is validated twice — `validateEnv` refuses to boot in production
with an incomplete SMTP setup, and `MailService.verify()` runs a connection
check after listen so a bad host or credential appears in the deploy log.

Known gaps, tracked rather than hidden:

- Notifications go only to account-linked submissions. A guest submission has no
  stored address, so it is skipped and recorded as such.
- The content scripts are not wired into CI; they run on demand.

## Phase 2A — Accounts and channel intake (implemented baseline)

- [x] Passport Local email/password and JWT sessions with rolling 14-day inactivity expiry
- [x] **Channel intake hardened (October 2026)** — the promise "one link, the whole
      channel" now holds: batched metadata calls, per-page cursor saves, resume
      after a partial failure, one walker per channel, and a non-music upload
      becomes a review candidate instead of being silently dropped. Details in
      [`runbook.md`](./runbook.md#youtube-import).
- [x] **One environment file** (`.env` at the repo root) for both stacks and host
      development; `infra/.env` and `.env.local` were retired.
- [x] **Responsive, consistent header and page shell** across every route.
- [x] Member, contributor, moderator and admin role enforcement
- [x] Public guest submissions with optional account attribution and public credit
- [x] Account submission history and top public contributor aggregate
- [x] Guest artist channel suggestions resolved through YouTube Data API
- [x] Admin channel add, suggestion review, sync status and imported draft song queue
- [x] Searchable song selection in the lyric submission form
- [x] Password reset: single-use link, SHA-256 stored (never the token), every
  session revoked on completion, no account enumeration in the response
- [x] Self-service account deletion: password-confirmed, audited, pending
  submissions withdrawn; published contributions are kept (the catalogue)
- [x] Email confirmation on sign-up (soft gate — unconfirmed accounts still browse and submit)
- [x] Account data export (JSON, credentials excluded)
- [ ] Artist verification/claim process and song edits beyond draft publication

**Exit:** rotate and deploy a strong JWT secret, configure the official YouTube
Data API key, and walk the account, submission, artist-review and import flows
through in the Dockerized environment before public launch.

Account lifecycle implemented in this pass:

- **Password reset.** `POST /api/auth/forgot-password` always answers
  `{ accepted: true }` — a real and an unknown address are indistinguishable, so
  the endpoint cannot be used to enumerate accounts. The token is 256 bits from
  the OS CSPRNG, stored only as SHA-256, single-use, valid for 60 minutes, and a
  new request invalidates every outstanding link for that user. Completing a
  reset revokes **all** sessions, which is the point of resetting at all.
  `GET /api/auth/reset-password/:token` lets the page say "expired" before a
  password is typed.
- **Deletion.** `POST /api/auth/delete-account` requires the current password, so
  a borrowed session cannot destroy an account. Pending submissions are deleted;
  published ones survive (`LyricsSubmission.user` is `onDelete: SetNull`) because
  they are the catalogue. Sessions and reset tokens cascade. The result is
  audited as `account.deleted`.
- **Email confirmation.** New accounts start unconfirmed. A single-use link
  (hashed at rest, valid 7 days, superseded by a resend) confirms the address.
  It is a **soft gate on purpose**: an unconfirmed account can still browse and
  submit lyrics, because punishing a visitor for not opening an email is how you
  lose them. The flag exists so the account page can prompt and so a future
  feature can require a proven address. Accounts created before the migration,
  seeded staff, and the migration's backfill are all confirmed.
- **Data export.** `GET /api/auth/export` returns one JSON document: account,
  submissions, reports filed, sessions. Password hashes and token hashes are
  excluded — they are credentials, not the user's data, and a Download folder is
  not where a credential belongs. The privacy page promised this; it now exists.
- **Mail.** `MailService` now has a real SMTP transport. A misconfigured provider
  refuses to send rather than dropping a reset link silently, and says why at
  boot.

All of it is covered against a live stack, with no mail server and no credentials
— each script creates and removes its own throwaway account:

- `npm run smoke:account-flows` — 19 checks: non-enumerable reset request, token
  stored, forged token refused, link supersession, password-confirmed deletion,
  and the cascade that proves nothing is left behind.
- `npm run smoke:confirmation-export` — 21 checks: sign-up works while
  unconfirmed, forged token refused, real token confirms, reuse reports
  `already_confirmed`, password unchanged; and the export is session-guarded,
  complete, and free of `passwordHash`/`tokenHash`.

## Phase 3 — The scene (DJs, podcasts, events)

- [x] `/djs` directory + profile + tracks spun
- [x] `/podcasts` shows + episodes linked to artists/songs
- [x] `/events` calendar + detail + lineup + ticket link
- [x] Search across all entity types
- [x] `/about` and `/support` content finalised
  *(written, and the legal pages they link to now match what the app does:
  export and deletion are built, not promised)*

**Exit:** the scene section has more than the artist catalogue, and search
returns results for every entity type.

All three scene reads were implemented in this pass. `DjsService`,
`PodcastsService` and `EventsService` had been stubs that returned empty lists and
threw `NotFound` for every profile, so the directory pages rendered nothing even
with seeded rows in the database. They now query Prisma: DJs with links, the
published songs they spin and their upcoming events; podcasts with episode counts
and full episode detail linking artists and songs; events filtered to upcoming
first, with city filter and artist/DJ lineup. Verified against the running stack —
`/djs`, `/podcasts` and `/events` return the seeded rows, and `/api/search` returns
all four entity types.

`POST /api/reports` was also a `501` stub; it now records a report against any
catalogue entity, rejects a target that does not exist, and collapses repeat open
reports of the same target into one row instead of growing the table.

## Phase 4 — Discovery & growth

- [x] Home page feeds: new songs, synced this week, emerging artists
- [x] Search ranking (exact → prefix → word-start → substring → body-only)
- [x] Open Graph share images per song (the YouTube thumbnail, already wired)
- [x] Sitemap automation + structured data for songs, artists and events
- [ ] Search typo tolerance (trigram tuning)
- [ ] Minimal privacy-respecting analytics (see architecture §9)

**Exit:** organic search is the top acquisition channel.

Shipped this pass:

- **`GET /api/songs/feeds`** returns three shelves in one request — newest,
  newly synchronized (`Song.syncedVersionId`), and emerging artists ranked by
  *fewest* published songs rather than newest profile. A profile with nothing
  published is not something a fan can act on, so artists with at least one
  song come first. `/` renders a shelf only when it has something that is not
  already in the featured list, so the page never repeats itself.
- **Ranking.** `apps/api/src/modules/search/relevance.ts` is a pure tiered
  scorer, applied after the existing `ILIKE` query. It fixes the ordering bug
  that put a song whose *lyrics* mention an artist above the artist's own
  songs. The SQL and its query plan are unchanged — ranking sorts at most eight
  rows per type.

Still open in this phase: typo tolerance, which needs a trigram index and a
migration, and analytics, which needs a provider decision before any code.

## Phase 5 — Community

- [ ] User playlists (public/private)
- [ ] Competitions and challenges with backend-enforced voting
- [ ] Contributor reputation and trusted-contributor fast track
- [ ] Artist claims (verification codes)

**Exit:** a competition runs end to end with an auditable vote trail.

## Phase 6 — Artist support (storefront links)

- [ ] Artist storefront fields + external checkout links
- [ ] Transparent commission display (no payment rails yet)
- [ ] `/support` shows actual funding usage

**Exit:** artists list products; we track outbound clicks, take no money.

## Phase 7 — Commerce, radio, expansion

Deferred until v1 retention is proven. Each item needs a separate decision doc:

- Native checkout (cards + M-Pesa), commission, payouts, refunds, disputes
- Drill Radio (requires licensing)
- PWA install + offline lyrics shell
- Swahili / Sheng interface strings
- Word-level lyric highlighting
- Public read API + partner integrations
- Drill scenes beyond Kenya

---

## Working agreements

- One phase in flight. New ideas go to `product.md` §4.2 or the backlog, not
  into the current branch.
- Every feature lands with tests for its pure logic; UI without logic still needs
  an e2e happy path.
- Docs move with the code: a change that alters a contract updates
  `architecture.md`, `api.md` or `lyrics-format.md` in the same PR.
