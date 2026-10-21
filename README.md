# DrillKe 🇰🇪

> The home of Kenyan drill. Synchronized lyrics for the music that defines the scene — **one track at a time**.

**Tagline:** _Read the bars while the music plays._

DrillKe is an open-source music discovery and lyrics platform built around Kenyan drill. Music plays from YouTube; DrillKe adds the lyrics, the context, the artists, the DJs, the podcasts and the events around it.

---

## Why this exists

Kenyan drill is growing faster than the places that can explain it.

- Fans find songs on YouTube but can't follow what is being said — lyrics are missing, wrong, or buried in comment sections.
- Sheng, slang and neighbourhood references are never explained, so new listeners miss the meaning.
- Emerging artists have no profile beyond their channel, and the scene around the music — DJs, podcasts, events — has no single index.

Every lyrics site treats this generically. **None of them treat Kenyan drill as a first-class scene.**

---

## The moat

> **The playing lyric line is the product.**

Every v1 decision serves one experience: open a song, play it, and follow the bars — with the slang explained inline. Marketplace, competitions and radio come later, and only once this is excellent.

---

## V1 at a glance

| In v1 | Deferred |
|---|---|
| Synchronized player + annotations | Marketplace / native checkout |
| Song & artist pages, search | Playlists, competitions, voting |
| Community lyrics with review | Drill Radio, Shorts |
| DJs, podcasts, events directories | Word-level highlighting, Swahili UI |
| About & Support pages | PWA, public API |

V1 also includes `/about` and `/support` — who we are, how the model works, and how to fund the work.

---

## Repository contents

| Path | What it is |
|---|---|
| `docs/product.md` | Product spec — problem, principles, **V1 scope**, success criteria |
| `docs/architecture.md` | System shape, modules, data model, security, trade-offs |
| `docs/roadmap.md` | Phased delivery (0–7) with exit criteria |
| `docs/lyrics-format.md` | The lyrics Markdown contract + parsed representation |
| `docs/api.md` | API contract — routes, payloads, errors |
| `docs/deploy.md` | Docker topology, environments, production deployment |
| `docs/runbook.md` | **Day-to-day**: start/stop both stacks, verify, configure, troubleshoot |
| `docs/runbook.md` | Start / stop / verify the two containers, ports, troubleshooting |
| `docs/context.md` | Original long-form brief (context only, not a spec) |

```text
apps/api         NestJS modular monolith (modules/, common/, workers/)
apps/web         Next.js App Router (app/, components/player, lib/)
packages/shared  Types + pure lyrics logic shared by both apps
prisma/          Schema, migrations, seed
infra/           docker-compose.yml (prod) + docker-compose.dev.yml (hot reload)
                 + backend entrypoint + .env.example
apps/api/scripts dev-watch.js  (tsc --watch + restart, emits decorator metadata)
docs/            The documents above
```

---

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js (App Router), React, TypeScript, CSS custom properties |
| API | NestJS, class-validator, throttler, helmet |
| Data | PostgreSQL 16 + Prisma |
| Playback | YouTube IFrame Player API |
| Tooling | npm workspaces, Docker Compose, GitHub Actions |

---

## Quick start

Docker is the default way to set up **and** develop DrillKe. It needs nothing on
your machine except Docker Desktop — no Node, no Postgres, no version drift
between engineers.

### Daily development (hot reload)

```bash
git clone <repo> && cd Drill-Lyrics-Ke
npm run dev:stack        # build + start; logs stream in this terminal
```

| Container | What runs | URL |
|---|---|---|
| `drill-lyrics-key-dev-api` | NestJS API **+ PostgreSQL 16** | http://localhost:4000/api/health/ready |
| `drill-lyrics-key-dev-web` | Next.js dev server | http://localhost:3000 |

Edit any file under `apps/` or `packages/` and the container recompiles and
reloads — no restart, no rebuild. Migrations and seed data are applied
automatically on first boot.

```bash
npm run dev:stack:bg     # start in the background instead
npm run dev:stack:logs   # tail api + web
npm run dev:stack:ps     # container status
npm run dev:stack:down   # STOP (database data is kept)
npm run dev:stack:reset  # stop and wipe the database
```

### Production-shaped run (compiled build)

Same two-container shape, but runs the compiled artefacts — use this to check
what will actually ship:

```bash
npm run stack:up         # build + start production images
npm run stack:ps
npm run stack:down
npm run stack:reset      # stop + wipe database
```

Raw Docker equivalent (any of the above):

```bash
docker compose -f infra/docker-compose.dev.yml up --build   # dev
docker compose -f infra/docker-compose.yml up -d --build    # prod-shaped
docker compose -f infra/docker-compose.yml down             # stop
```

Both stacks appear in Docker Desktop as the projects **`drill-lyrics-key-dev`**
and **`drill-lyrics-key`**. They are namespaced separately and can run at the
same time only if you change ports in `infra/.env`.

### Optional: local processes (no Docker)

Only if you prefer it — requires Node ≥ 22 and a reachable Postgres 16.

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres
npm run prisma:migrate
npm run db:seed
npm run dev                   # web  → http://localhost:3000
npm run dev:api               # api  → http://localhost:4000/api/health/ready
```

Full runbook — ports, configuration, verification, troubleshooting:
[`docs/runbook.md`](docs/runbook.md).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` / `npm run dev:api` | Start web / API in watch mode |
| `npm run build` | Build shared → api → web |
| `npm run typecheck` | TypeScript across workspaces |
| `npm test` | Unit tests (pure logic, no DB) |
| `npm run dev:stack` | **Daily dev**: build + start containers with hot reload |
| `npm run dev:stack:bg` | Same, in the background |
| `npm run dev:stack:down` | Stop the dev stack (keeps database data) |
| `npm run dev:stack:reset` | Stop and wipe the dev database |
| `npm run dev:stack:logs` | Tail dev api + web logs |
| `npm run dev:stack:ps` | Show dev container status |
| `npm run stack:up` | **Production-shaped**: build + start compiled images |
| `npm run stack:start` | Start existing production containers (no rebuild) |
| `npm run stack:down` | Stop the production-shaped stack (keeps data) |
| `npm run stack:reset` | Stop and wipe the production database |
| `npm run stack:ps` | Show production container status |
| `npm run stack:logs` | Tail production api + web logs |
| `npm run docker:build` | Build both images without starting anything |
| `npm run docker:build:api` | Build production API image (`Dockerfile`) |
| `npm run docker:build:web` | Build production web image (`apps/web/Dockerfile`) |
| `npm run prisma:migrate` | Create + apply a dev migration |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` / `db:reset` | Seed / reset + seed |


---

## Status

**Phase 0 — scaffold.** Structure, contracts, Docker and docs are in place; feature code lands in the next sessions. See [`docs/roadmap.md`](docs/roadmap.md).

---

## Contributing

Conventional Commits (`feat(player): click-to-seek`). Run `npm run typecheck && npm test` before opening a PR. Only submit lyrics you have the right to share — see [`docs/product.md`](docs/product.md) §5.4.

---

## License

**Code:** MIT *(proposed)*. **Content:** lyrics, artwork and artist names are **not** covered and remain with their owners.

---

<p align="center">
  <b>DrillKe</b> · Built by the community, for the culture. 🇰🇪<br/>
  <i>One track at a time.</i>
</p>

