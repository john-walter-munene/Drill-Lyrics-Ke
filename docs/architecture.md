# DrillKe — Architecture

The system as it will be built, and the reasoning behind each boundary. Product
scope lives in [`product.md`](./product.md); sequencing in
[`roadmap.md`](./roadmap.md).

---

## 1. Shape

Two applications, one shared package, one database, one deployable stack.

```text
┌───────────────────────────────────────────────────────────────────┐
│                            Browser                                │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────┐    │
│  │ Player (pers.)│◄─┤ Lyrics engine   │   │ Catalogue /      │    │
│  │ YouTube IFrame│  │ active-line idx │   │ Search / Admin   │    │
│  └──────┬───────┘   └─────────────────┘   └────────┬─────────┘    │
└─────────┼──────────────────────────────────────────┼──────────────┘
          │ IFrame API                               │ fetch (JSON)
          ▼                                          ▼
   ┌─────────────┐                     ┌───────────────────────────┐
   │  YouTube    │                     │  apps/web (Next.js SSR)   │
   │  playback   │                     │  server components + BFF  │
   └─────────────┘                     └────────────┬──────────────┘
                                                    │ HTTPS
                                                    ▼
                                     ┌───────────────────────────────┐
                                     │ apps/api (NestJS)             │
                                     │ modules · validation · auth   │
                                     │ throttling · review · audit   │
                                     └──────┬──────────────┬─────────┘
                                            │              │
                                            ▼              ▼
                                     ┌────────────┐  ┌──────────────┐
                                     │ PostgreSQL │  │ YouTube Data │
                                     │ (Prisma)   │  │ API (import) │
                                     └────────────┘  └──────────────┘
```

### Why an API at all (it is one database)

The long-form brief proposed a single Next.js app. We split it because:

- **The API is the public contract.** Contributors, a future mobile client and
  partners read the same `/api` — see [`api.md`](./api.md).
- **Server-side authority.** Validation, roles, throttling and audit live in one
  place, not in page handlers and route handlers that drift apart.
- **Independent scaling and deploys.** The web app is CDN-friendly and mostly
  static; the API is stateful and needs a DB connection pool.

It is a **modular monolith**: one Nest process, feature modules with explicit
boundaries. A worker is the same image run with a different command.

---

## 2. Repository layout

```text
drillke/
├── apps/
│   ├── api/                      # NestJS modular monolith
│   │   ├── src/
│   │   │   ├── main.ts           # bootstrap: helmet, CORS, pipes, filters
│   │   │   ├── app.module.ts     # root module + global throttler
│   │   │   ├── prisma.service.ts
│   │   │   ├── common/           # config, logging, throttling, guards, filters
│   │   │   ├── modules/          # one folder per feature (see §3)
│   │   │   ├── library/          # reusable integrations (YouTube metadata)
│   │   │   └── workers/          # out-of-band loops (YouTube sync)
│   │   └── tsconfig.json
│   └── web/                      # Next.js App Router
│       ├── app/                  # routes
│       │   ├── components/       # shared UI incl. player/
│       │   └── (routes…)
│       ├── api/                  # centralized frontend API client and endpoints
│       ├── lib/                  # formatting, seo
│       └── next.config.js
├── packages/
│   └── shared/                   # types + pure logic shared by both apps
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.mjs
├── infra/
│   ├── docker-compose.yml        # production-shaped: api (+ Postgres) + web
│   ├── docker-compose.dev.yml    # same shape, hot reload for daily work
│   ├── Dockerfile.dev            # dev image (Node toolchain + PostgreSQL 16)
│   ├── docker-entrypoint.sh      # inits Postgres, migrates, seeds, starts the API
│   └── .env.example              # optional port / secret overrides
├── docs/
│   └── runbook.md                # start / stop / verify / troubleshoot
├── .github/workflows/ci.yml
├── .env.example
├── tsconfig.base.json
└── package.json                  # npm workspaces
```

Conventions (deliberately identical to the sibling `overlay` project):

- **npm workspaces**, scoped package names `@drillke/{shared,api,web}`.
- **Prisma schema at the repo root** (`prisma/schema.prisma`), not inside the API,
  so the web app and scripts can import the generated client.
- **`tsconfig.base.json`** is extended by every package; the API overrides to
  CommonJS + decorators, the web app to `bundler` + `react-jsx`.
- **Feature modules are self-contained**: `*.module.ts`, `*.controller.ts`,
  `*.service.ts`, `dto/`, and pure helpers in sibling `.ts` files with `.test.ts`
  next to them.
- **Pure logic lives in `packages/shared`** with `.ts` import extensions, so it
  can be tested with `node --experimental-strip-types --test` and no build step.

---

## 3. API modules

| Module | Route prefix | Responsibility |
|---|---|---|
| `health` | `/api/health` | Liveness (cheap) and readiness (DB) |
| `auth` | `/api/auth` | Sign-up, sign-in, session, current user |
| `artists` | `/api/artists` | Artist profiles, links, catalogue |
| `songs` | `/api/songs` | Song records, lyric payload, playback metadata |
| `lyrics` | `/api/lyrics` | Text submissions, review queue and published versions |
| `search` | `/api/search` | Capped case-insensitive catalogue search across published lyrics and scene entities |
| `djs` | `/api/djs` | DJ directory, profile, tracks spun |
| `podcasts` | `/api/podcasts` | Shows, episodes, artist/song links |
| `events` | `/api/events` | Events, lineups |
| `reports` | `/api/reports` | Report an issue against any entity |
| `admin` | `/api/admin` | Roles, audit log, moderation dashboard data |
| `workers/youtube-sync` | — | Verified artist uploads playlist import; drafts only |

Rules:

- Every DTO is validated by the global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Writes use `writeThrottle()`; auth uses `authThrottle()`.
- Public reads are cacheable; review/admin routes are not.
- Errors share one envelope (`AllExceptionsFilter`): `{ statusCode, error,
  message, path, timestamp }`. Unknown errors never leak a stack.

## 4. Data model

Full Prisma schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

```text
User ──< Session
 ├──< PasswordResetToken
 ├──< EmailConfirmationToken
 │
 ├──< LyricsSubmission >── Song
 │                          │
 │                          ├──< LyricVersion ──< LyricLine
 │                          │        └────────< Annotation
 │                          │
 │                          └──< SongArtist >── Artist ──< ArtistLink
 │
 ├──< DjTrack >── Dj (profile) ──< EventDj >── Event
 │
 ├──< Report (polymorphic target)
 └──< AuditLog

Podcast ──< PodcastEpisode ──(optional)──> Song / Artist
```

Modelling decisions worth knowing:

1. **`LyricVersion` is immutable.** Lines and annotations belong to a version, so
   a rollback is a pointer change, never a data loss.
2. **`syncStatus` is explicit** (`unsynchronized` | `synchronized`) and is a
   property of the *version*, not the song — a song can be unsynced today and
   synced tomorrow without losing history.
3. **Songs are media references.** `youtubeVideoId` is required; audio hosting is
   not modelled at all, on purpose.
   Verified artists' uploads are enumerated through the YouTube Data API and
   inserted as draft song candidates. A reusable library helper reads public
   video details through YouTube oEmbed; it does not scrape YouTube HTML.
   oEmbed does not provide a stable channel ID, so channel imports use the
   YouTube Data API. The app does not publish every channel upload as a song
   without review. API-derived titles
   and dates are refreshed before their 30-day storage window expires; an
   unavailable video loses its imported metadata.
4. **Artists and DJs are separate entities.** Someone can be both; linking them
   is a v2 `ArtistDjLink`, not a polymorphic identity table now.
5. **Events reference entities by id**, and lineups are join rows
   (`EventArtist`, `EventDj`) so removal/ordering is explicit.
6. **`Report` has no foreign keys to its target** — `targetType` + `targetId` —
   because it spans many entities and an FK per type would explode the schema.

## 5. Lyrics pipeline

```text
Plain text ([mm:ss.mmm] optional per line), selected songId
        │  posted to POST /api/lyrics/submissions (legacy field: `markdown`)
        ▼
Server validation (shared parser, never trusts the client)
        │  → LyricsSubmission { status: pending, body }
        ▼
Reviewer approves in /admin
        ▼
LyricVersion { syncStatus, lines[], annotations[] }  ← immutable
        ▼
GET /api/songs/:id/lyrics returns one compact payload
        ▼
Browser: LyricsEngine (binary search on timestamps)
```

The client fetches **once per song**, not once per line. The browser's persistent
YouTube IFrame Player API instance is the playback clock and control boundary.
The lyrics view reads current time from player state, and line selection seeks
that same instance. The engine:

- holds `lines: LyricLine[]` sorted by `startMs`;
- reads the player clock on an animation frame;
- binary-searches for the active index;
- updates state only when the index changes;
- scrolls only if the active line left the viewport.

The moderator timing editor can mark lines while the same YouTube player runs.
Pending text is edited before approval; timing changes to published lyrics create
a new immutable `LyricVersion`, update the song's active version pointer, and
retain the previous version for history.

Catalogue play actions pass an ordered queue to the persistent player. On an
ended event it loads the next video into the existing iframe, avoiding an
iframe teardown/recreate cycle. YouTube controls remain visible and playback
starts only after a user action. This can reduce app-side transition overhead,
but cannot guarantee gapless playback: YouTube controls the media pipeline and
buffering. Crossfading by overlapping videos or manipulating their audio is
outside this architecture; a crossfade would require a separately licensed
audio source.

Marker help for the next sessions is in [`lyrics-format.md`](./lyrics-format.md).

Published lyric payloads include reviewed annotations, and the lyrics view
displays an annotation control beside its anchored line. Authoring happens in
the admin review queue: a moderator anchors a phrase to a reviewed line, the
shared `resolveAnnotations` validates that the phrase actually appears on that
line and enforces the size limits, and saving or approving the version persists
the annotations with it. Because `LyricVersion` is immutable, an annotation
edit on a published song creates a new version rather than mutating the old one.
The `/search` page uses the same public API contract as other web
data access through `apps/web/api/index.ts`.

The initial search implementation uses PostgreSQL case-insensitive substring
matching over published song titles, artist names and published lyric lines,
plus the scene entities. It returns at most eight results per entity type and
caps queries at 100 characters. This is suitable for the current small
catalogue; full-text ranking and typo-tolerant trigram search remain future
work and are not implemented yet.

The browser submission form accepts either plain text or a Markdown document,
tied to a searched, published `songId`. The server picks the parser from the
body shape (`common/submission-shape.ts`) so a Markdown document is validated
for frontmatter and annotations while a text paste is not. Guest submissions
remain anonymous. Signed-in users are attached to their submission and may
separately opt into public contributor credit.

Review outcomes notify the contributor through `MailService`. The **mock
provider is the default**: it writes a structured `mail` log line instead of
sending, so the whole path works with no SMTP account and no chance of mailing a
real address from a development machine. `MAIL_PROVIDER=smtp` runs a real
`nodemailer` transport.

Delivery runs *after* the mutating transaction commits and can never fail the
action that triggered it; the audit log records
`lyrics.notification_sent|skipped|failed` with the reason. A guest submission has
no stored address, so it is skipped explicitly rather than silently. Message
text is pure and lives in `packages/shared` (`review-notifications.ts`,
`account-emails.ts`), so swapping the transport never changes a word a
contributor reads.

**SMTP is validated twice, at different moments.** `validateEnv` refuses to boot
in production with an incomplete `SMTP_*` / `MAIL_FROM` set, so a missing
`SMTP_HOST` cannot reach production. `MailService.verify()` then runs
`transporter.verify()` after the server is listening — not before, so a mailer
that is briefly unreachable cannot take the API down — and logs the result, so a
bad credential shows up in the deploy log rather than in a user's "I never got
the reset email" report. At send time a misconfigured provider returns
`delivered: false` with the reason; it never silently drops a reset link.

The `content/` scripts (`scripts/content.mjs`) are the authoring path for bulk
work: export writes one Markdown file per published song, import turns changed
files into **pending** submissions. Import never publishes — a moderator still
reviews, exactly as for a submission from the site.
Passport Local validates email/password; signed JWTs live in HttpOnly cookies
for browsers (or Bearer headers for API clients). A server-side revocable
session tracks activity and expires after 14 days without a request; active
sessions receive a refreshed JWT before its fixed 14-day expiry. Admin and
moderator actions, including publishing, write to the audit log.

**Password reset and email confirmation are high-entropy tokens, not secret
answers.** The token is 32
bytes from the OS CSPRNG, sent in the URL path (not a query string, which leaks
through `Referer` to third-party resources), and stored **only as SHA-256**.
SHA-256 rather than scrypt is correct here: the input already has 256 bits of
entropy, so there is nothing to slow down, and the lookup must be exact. A
leaked database therefore yields no usable links. Tokens are single-use (`usedAt`
is kept rather than the row deleted, so a replay is distinguishable from a
forgery), live 60 minutes, and a new request invalidates every outstanding link
for that user. Completing a reset deletes every session — the entire point of
resetting is that any other holder of the old password loses access.

The request endpoint is deliberately non-enumerable: it answers
`{ accepted: true }` for any well-formed address, and the logs — not the response
— are where "no such account" appears. Rate limiting is what stops it being a
mail-bomb. Reset and deletion pages are `noindex, nofollow` and listed in
`robots.txt`.

**Email confirmation is a soft gate, on purpose.** `emailVerifiedAt` is a
nullable timestamp rather than a required step, because v1 does not stop an
unconfirmed visitor from browsing or contributing — the flag exists so the
account page can prompt and so a future feature can require a proven address.
Confirmation tokens are a **separate table** from reset tokens, not a `kind`
column: one token must never be spendable as the other, or a confirmation link
would become a password-reset link. The migration backfills
`emailVerifiedAt = createdAt` for existing rows, because those accounts were
created when no confirmation step existed and marking them unverified would be a
lie about their state.

**Account export** is the read-side counterpart to deletion: one JSON document
of the user's own rows. Passwords and token hashes are excluded — they are
credentials, and a file in a Downloads folder is the last place one belongs.

**Account deletion** is self-service but password-confirmed, because a borrowed
session must not be able to destroy an account. What survives is a deliberate
choice: authored lyrics that were already published (`LyricsSubmission.user` is
`onDelete: SetNull`) because removing them would delete the catalogue everyone
else reads, and the `contributorName` byline a contributor explicitly opted
into. Pending submissions are withdrawn, sessions and reset tokens cascade, and
the action is audited before the user row goes.

In the moderation queue, a moderator can start the queued song in the same
persistent YouTube player, stamp each lyric line from its current clock, and
save the timestamped pending submission. The shared parser enforces ordered
timestamps; only a moderator's separate approval action publishes a version.
Every timing edit is recorded in `AuditLog` with its timed-line count.

Artist channel intake uses the official YouTube Data API, not page scraping.
Guests or members may submit a channel ID, supported channel URL, or @handle.
The channel and sample uploads are saved as a suggestion for a moderator to
review. An administrator may add a channel directly. Imports create draft song
candidates; each upload must be reviewed before public catalogue publication.
`Artist.verified` represents identity/rights verification and is independent
from `youtubeSyncEnabled`, which controls metadata import.

### Channel import

`YoutubeSyncService.syncArtistNow(artistId, { force, pages, restart })` owns the
whole acquisition path (`apps/api/src/workers/youtube-sync.service.ts`).

1. **Resolve.** A pasted reference — `@handle`, `/channel/UC…`, `/c/`, `/user/`,
   or any video URL — becomes a channel id, then an uploads playlist id.
2. **Bound.** The first `playlistItems` call also reports `pageInfo.totalResults`,
   the channel's upload count. The walk stops at that number, so YouTube's
   `nextPageToken` cannot drag the importer into re-reading pages.
3. **Read a page, batch the metadata.** All 50 uploads of a page are resolved in
   one `videos.list` call (`id` up to 50 ids, one quota unit). Per-video calls, as
   an earlier version used, spent one unit per upload.
4. **Classify** with `youtube-classify.ts` (pure, unit-tested). Music-category
   uploads become `draft` songs; a `video`/`unclear` verdict becomes a review
   candidate with `youtubeImportKind` set; shorts, live streams and sub-30s
   clips are not imported at all. A run of 25 non-music uploads pauses the walk
   unless `force` is set.
5. **Save after every page.** `YoutubeChannelSync` holds the cursor
   (`nextPageToken`), `initialImportComplete` and the last counts. A failure on
   page 30 of 40 keeps pages 1–29 and resumes at 30.

Guarantees the cabinet relies on:

- **One walker per channel.** `syncArtistNow` refuses a second concurrent call
  for the same artist (`409`). The cursor is a single row; two walkers would
  overwrite each other's position, which is precisely how an import appears to
  hang or start over.
- **Idempotent by video id.** `Song.youtubeVideoId` is unique and every import
  upserts on it, so re-running a sync never duplicates a song.
- **Partial results, not all-or-nothing.** A quota or network failure throws
  nothing away and is reported on the result (`error`) so the admin UI can say
  what was saved and how to continue.
- A second `Sync whole channel` after a finished walk is a genuine re-check;
  `restart: true` walks from the newest upload again.

Configuration lives in one place: `YOUTUBE_API_KEY` in the repo-root `.env`
(see [`runbook.md`](./runbook.md#youtube-import)). `EMBED_WORKER` runs the same
service on an interval inside the API process for new uploads.

## 6. Web rendering

| Page | Rendering | Why |
|---|---|---|
| Home, About, Support | Static (ISR 1h) | Rarely changes |
| Song, Artist, DJ, Podcast, Event | Server-rendered, ISR 5 min | SEO + fast first paint |
| Submit | Client form, server-validated | Live Markdown feedback without a round trip |
| Search | Dynamic, client-refined | Query-dependent |
| Admin, account | Dynamic, authenticated | Never cached |
| Player | Client component in root layout | Survives navigation |

SEO is a growth channel, so it is a build-time contract:

- Canonical URLs, unique titles/descriptions, OG + Twitter cards.
- JSON-LD: `MusicRecording` (song), `MusicGroup` (artist), `Event` (event),
  `PodcastEpisode` (episode), `BreadcrumbList`.
- `sitemap.ts` and `robots.ts` generated from the API's sitemap endpoint.
- Only `published` entities are indexable; drafts return `noindex`.

## 7. Security

- Roles enforced **server-side** on every mutating route (`RolesGuard`).
- Helmet, explicit CORS allow-list, body-size cap.
- Server-side validation; submitted text is rendered as escaped text. Markdown
  import/export writes and reads the documented format only — no raw HTML path
  exists in either direction.
- Rate limiting per IP with stricter buckets for auth and writes.
- Secrets only in env; production refuses to boot on weak/default secrets.
- `AuditLog` for every review, role change and unpublish, and for every review
  notification (`lyrics.notification_sent|skipped|failed`).
- Email addresses are masked in logs (`redactEmail`); no PII in analytics.
- Dependency audit and container scan are manual — there is no CI pipeline at
  the moment (see `roadmap.md` Phase 0).

## 8. Cost posture

The stack is chosen to run on free/low tiers until traffic proves otherwise:
managed Postgres free tier, video never hosted, ISR + CDN for public pages,
Postgres substring matching instead of a search service, and a single API process
(worker embedded) until throughput demands otherwise.

## 9. Analytics

Page-view and player events only (`play`, `25/50/75/100%`, `seek`, `lyric_click`,
`annotation_open`, `submit`). No PII, no cross-site identifiers, no fingerprinting.
Stored as aggregate counts; raw events dropped after 30 days.

## 10. Known trade-offs

| Trade-off | Accepted because |
|---|---|
| YouTube clock is the source of truth | Lyrics can never drift from playback; no audio hosting |
| Line-level, not word-level, sync | Authoring cost is far lower; word-level is a polish pass |
| No artist accounts in v1 | Verification and claims need support processes we do not have yet |
| Substring matching, not a search engine | Simple MVP matching; ranking and typo tolerance wait for catalogue/search usage data |
| Events and podcasts are metadata-only | No media hosting, no ticketing, no licensing exposure |
