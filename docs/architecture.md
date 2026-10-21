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
│   │   │   └── workers/          # out-of-band loops (YouTube sync)
│   │   └── tsconfig.json
│   └── web/                      # Next.js App Router
│       ├── app/                  # routes
│       │   ├── components/       # shared UI incl. player/
│       │   └── (routes…)
│       ├── lib/                  # api client, formatting, seo
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
| `lyrics` | `/api/lyrics` | Submissions, review queue, versions, import/export |
| `search` | `/api/search` | Cross-entity search (Postgres FTS + trigram) |
| `djs` | `/api/djs` | DJ directory, profile, tracks spun |
| `podcasts` | `/api/podcasts` | Shows, episodes, artist/song links |
| `events` | `/api/events` | Events, lineups |
| `reports` | `/api/reports` | Report an issue against any entity |
| `admin` | `/api/admin` | Roles, audit log, moderation dashboard data |
| `workers/youtube-sync` | — | Metadata import run (interval or on-demand) |

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
4. **Artists and DJs are separate entities.** Someone can be both; linking them
   is a v2 `ArtistDjLink`, not a polymorphic identity table now.
5. **Events reference entities by id**, and lineups are join rows
   (`EventArtist`, `EventDj`) so removal/ordering is explicit.
6. **`Report` has no foreign keys to its target** — `targetType` + `targetId` —
   because it spans many entities and an FK per type would explode the schema.

## 5. Lyrics pipeline

```text
Markdown (frontmatter + [mm:ss.mmm] lines + annotations)
        │  posted to POST /api/lyrics/submissions
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

The client fetches **once per song**, not once per line. The engine:

- holds `lines: LyricLine[]` sorted by `startMs`;
- reads the player clock on an animation frame;
- binary-searches for the active index;
- updates state only when the index changes;
- scrolls only if the active line left the viewport.

Marker help for the next sessions is in [`lyrics-format.md`](./lyrics-format.md).

## 6. Web rendering

| Page | Rendering | Why |
|---|---|---|
| Home, About, Support | Static (ISR 1h) | Rarely changes |
| Song, Artist, DJ, Podcast, Event | Server-rendered, ISR 5 min | SEO + fast first paint |
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
- Server-side validation and sanitisation; Markdown is rendered without raw HTML.
- Rate limiting per IP with stricter buckets for auth and writes.
- Secrets only in env; production refuses to boot on weak/default secrets.
- `AuditLog` for every review, role change and unpublish.
- Dependency audit and container scan in CI.

## 8. Cost posture

The stack is chosen to run on free/low tiers until traffic proves otherwise:
managed Postgres free tier, video never hosted, ISR + CDN for public pages,
Postgres full-text search instead of a search service, and a single API process
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
| Postgres FTS, not a search engine | One less service; trigram search is enough for a catalogue this size |
| Events and podcasts are metadata-only | No media hosting, no ticketing, no licensing exposure |
