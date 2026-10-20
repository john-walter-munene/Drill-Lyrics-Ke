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
| `docs/deploy.md` | Docker + production runbook and troubleshooting |
| `docs/context.md` | Original long-form brief (context only, not a spec) |

```text
apps/api         NestJS modular monolith (modules/, common/, workers/)
apps/web         Next.js App Router (app/, components/player, lib/)
packages/shared  Types + pure lyrics logic shared by both apps
prisma/          Schema, migrations, seed
infra/           docker-compose (db only / full stack), Dockerfile.api
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

### Option A — Docker dev stack (recommended, zero local setup)

Everything runs inside containers with hot-reload. No local Postgres or Node needed beyond what runs the `npm` commands.

```bash
cp .env.example .env           # review; defaults are fine for local dev

npm run dev:stack              # builds containers + starts pg, redis, api, web
#  web → http://localhost:3000
#  api → http://localhost:4000/api/health/ready
```

Other useful commands:

```bash
npm run dev:stack:down         # stop containers (keeps database data)
npm run dev:stack:reset        # stop + wipe volumes (fresh database)
npm run dev:stack:logs         # tail api + web logs
```

### Option B — Local processes (fastest inner loop)

Requires Node ≥ 22 and a local/Docker Postgres.

```bash
npm install
cp .env.example .env

npm run db:up                  # Postgres + Redis (Docker)
npm run prisma:migrate
npm run db:seed

npm run dev                    # web  → http://localhost:3000
npm run dev:api                # api  → http://localhost:4000/api/health/ready
```

Full runbook, environment variables and deployment: [`docs/deploy.md`](docs/deploy.md).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` / `npm run dev:api` | Start web / API in watch mode |
| `npm run build` | Build shared → api → web |
| `npm run typecheck` | TypeScript across workspaces |
| `npm test` | Unit tests (pure logic, no DB) |
| `npm run dev:stack` | **Docker dev stack** (pg + redis + api + web, hot reload) |
| `npm run dev:stack:down` | Stop dev stack (keeps data) |
| `npm run dev:stack:reset` | Wipe dev stack volumes (fresh DB) |
| `npm run dev:stack:logs` | Tail api + web container logs |
| `npm run docker:build` | Build all Docker images (dev, api, web) |
| `npm run docker:build:dev` | Build dev/tooling image (`infra/Dockerfile.dev`) |
| `npm run docker:build:api` | Build production API image (`Dockerfile`) |
| `npm run docker:build:web` | Build production web image (`apps/web/Dockerfile`) |
| `npm run docker:check` | Run containerized verification (typecheck + test + lint) |
| `npm run docker:test` | Run unit tests inside the dev container |
| `npm run docker:typecheck` | Run TypeScript check inside the dev container |
| `npm run docker:lint` | Run workspace linting inside the dev container |
| `npm run db:up` / `db:down` | Local Postgres + Redis only |
| `npm run stack:up` / `stack:down` | Full production-like Docker stack |
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

