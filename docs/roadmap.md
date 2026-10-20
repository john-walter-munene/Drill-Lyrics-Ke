# DrillKe — Roadmap

Phases are goals with exit criteria, not dates. A phase does not start until the
previous one's exit criteria are met **in production**, not on a branch.

Scope for the current phase is fixed by [`product.md`](./product.md) §4.

---

## Phase 0 — Scaffold ✅ (this commit)

- [x] npm workspace monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [x] Prisma schema + baseline migration directory + seed
- [x] Docker: Postgres dev compose + full stack compose + API image
- [x] CI workflow (lockfile, build, pure-logic tests)
- [x] Docs: product, architecture, roadmap, lyrics format, API, deploy
- [ ] `npm install` and first green `npm run build` on a developer machine

**Exit:** `npm run db:up && npm run prisma:migrate && npm run dev` serves a page
that talks to `/api/health`.

## Phase 1 — The player (v1 core)

The only phase that matters for market entry.

- [ ] Lyrics parser in `packages/shared` + tests (timestamps, ordering, edge cases)
- [ ] `GET /api/songs/:slug` and `GET /api/songs/:slug/lyrics`
- [ ] Persistent YouTube player + facade + timing engine
- [ ] Active-line highlight, auto-scroll, click-to-seek, `aria-current`
- [ ] Unsynchronized fallback state
- [ ] Song page SSR + metadata + `MusicRecording` JSON-LD
- [ ] Artist page + catalogue
- [ ] Seed 10 real songs to validate before asking for contributions

**Exit:** 10 songs play with synced lyrics on a real phone, p75 first play
< 2.5 s, Lighthouse a11y ≥ 95.

## Phase 2 — Contribution & review

- [ ] `POST /api/lyrics/submissions` (validated, throttled, versioned)
- [ ] Upload a Markdown file + paste editor
- [ ] `/admin` review queue: preview, approve, request changes, reject
- [ ] `AuditLog` writes on every review action
- [ ] Markdown import/export scripts (`content/`)
- [ ] Notifications on review outcome (email, mock provider first)

**Exit:** a non-developer can submit lyrics and a reviewer can publish them
without touching Git. ≥ 50 published songs.

## Phase 3 — The scene (DJs, podcasts, events)

- [ ] `/djs` directory + profile + tracks spun
- [ ] `/podcasts` shows + episodes linked to artists/songs
- [ ] `/events` calendar + detail + lineup + ticket link
- [ ] Search across all entity types
- [ ] `/about` and `/support` content finalised

**Exit:** the scene section has more than the artist catalogue, and search
returns results for every entity type.

## Phase 4 — Discovery & growth

- [ ] Home page feeds: new songs, synced this week, emerging artists
- [ ] Search ranking + typo tolerance (trigram tuning)
- [ ] Open Graph share images per song
- [ ] Sitemap automation + structured data for every entity
- [ ] Minimal privacy-respecting analytics (see architecture §9)

**Exit:** organic search is the top acquisition channel.

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
