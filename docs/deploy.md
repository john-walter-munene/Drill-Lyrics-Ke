# DrillKe — Deploy & run

Two ways to run the project: **Docker** for a reproducible stack, **local** for
fast iteration. The Docker path is mandatory in CI and recommended for any
shared environment — it removes "works on my machine" collisions entirely.

---

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | ≥ 22 | local dev (uses native env-file + TS stripping) |
| npm | ≥ 10 | workspaces |
| Docker Desktop | recent | Postgres, or the full stack |

## 2. Docker — the default path

Docker drives both setup and day-to-day development. Everything the app needs
lives in `infra/`, and **the whole app always runs in two containers**: one
backend that owns the API *and* PostgreSQL, plus one frontend.

| | Development | Production-shaped |
|---|---|---|
| Compose file | `infra/docker-compose.dev.yml` | `infra/docker-compose.yml` |
| Project | `drill-lyrics-key-dev` | `drill-lyrics-key` |
| Backend | `drill-lyrics-key-dev-api` (`infra/Dockerfile.dev`) | `drill-lyrics-key-api-1` (`Dockerfile`) |
| Frontend | `drill-lyrics-key-dev-web` (`infra/Dockerfile.dev`) | `drill-lyrics-key-web-1` (`apps/web/Dockerfile`) |
| Reload | hot reload (bind mount) | none — rebuild to pick up changes |
| Ports | `3000` web · `4000` api · `5432` db | same |

The database lives inside the backend container by design: two containers
instead of three, and starting the stack alone produces a migrated, seeded,
working app. The backend entrypoint (`infra/docker-entrypoint.sh`) initialises
PostgreSQL, creates the role/database, applies Prisma migrations and seeds.

### 2a. Daily development (hot reload)

```bash
npm run dev:stack       # build + start; logs stream until Ctrl+C
npm run dev:stack:bg    # start in the background
npm run dev:stack:ps    # container status
npm run dev:stack:logs  # tail api + web
npm run dev:stack:down  # STOP — database data is kept
npm run dev:stack:reset # stop and delete the database volume
```

The repository is bind-mounted at `/app`; `apps/api` recompiles via
`tsc --watch` and `apps/web` via `next dev`. `node_modules` lives in a named
volume so host and container installs never clash.

### 2b. Production-shaped stack

Compiled artefacts, same shape as what ships:

```bash
npm run stack:up        # docker compose -f infra/docker-compose.yml up -d --build
npm run stack:ps        # both containers should report (healthy)
npm run stack:logs      # tail api + web
npm run stack:down      # STOP — database data is kept in the pgdata volume
npm run stack:start     # start the existing containers again (no rebuild)
npm run stack:reset     # stop and wipe the database volume
```

URLs (either stack): web → http://localhost:3000 · api readiness →
http://localhost:4000/api/health/ready

> Step-by-step verification, port changes and troubleshooting are in
> [`runbook.md`](./runbook.md).

### 2c. Configuration

Compose defaults work with no setup. To change ports or secrets:

```bash
cp infra/.env.example infra/.env
```

Compose reads `infra/.env` automatically for **both** stacks. Keys: `WEB_PORT`,
`API_PORT`, `DB_PORT`, `POSTGRES_*`, `JWT_SECRET`, `CORS_ORIGINS`,
`SEED_ON_START`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`.

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so
changing them requires rebuilding the web image (`npm run stack:up`). In the dev
stack they are read when the container starts.

### 2d. Local processes (optional)

Run the apps natively against any Postgres 16 you have:

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run db:seed
npm run dev                     # web  :3000
npm run dev:api                 # api  :4000
```

> The API dev runner compiles with `tsc --watch`, not `tsx`: Nest needs
> `emitDecoratorMetadata` for dependency injection and `tsx` silently drops it.

### 2e. Building images directly

```bash
npm run docker:build            # both images
npm run docker:build:api        # production API image (Dockerfile)
npm run docker:build:web        # production web image (apps/web/Dockerfile)
```

### 2f. Containerised checks

Unit tests and typechecking need no database:

```bash
npm test
npm run typecheck
npm run lint
```

### What is containerised, and why

| Service | Image | Purpose |
|---|---|---|
| `api` | `Dockerfile` (prod) / `infra/Dockerfile.dev` (dev) | NestJS API **+ PostgreSQL 16**, migrated and seeded on boot. Healthcheck gates `web`. |
| `web` | `apps/web/Dockerfile` (prod) / `infra/Dockerfile.dev` (dev) | Next.js server. Waits for `api` to be healthy. |
| `install` (dev, one-shot) | `infra/Dockerfile.dev` | Runs `npm ci` into a shared volume when manifests change. |

Isolation choices that prevent collisions:

- **Pinned project names** (`drill-lyrics-key`, `drill-lyrics-key-dev`) —
  containers, networks and volumes are namespaced and cannot collide with
  another checkout or application.
- **Named volumes** — `drill-lyrics-key_pgdata` (prod) and
  `drill-lyrics-key-dev_node_modules` / `_next_cache` / `_pgdata` (dev). Data
  survives rebuilds; `:*reset` scripts wipe it deliberately.
- **Explicit env in compose**, not a shared `.env` — apart from the optional
  `infra/.env`, so a dev secret never leaks into a shared environment.
- **`localhost` inside the container** is correct here: the API and its
  database share a network namespace.


## 3. Local (without Docker)

```bash
npm install
cp .env.example .env          # edit secrets if needed
# Point DATABASE_URL at any Postgres 16+ (local install, or the db published
# from the backend container on localhost:5432)
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev                   # :3000
npm run dev:api               # :4000
```

Health check: <http://localhost:4000/api/health/ready> should return `{ "status": "ok" }`.

## 4. Environment variables

See [`.env.example`](../.env.example). Rules:

- `NEXT_PUBLIC_*` is inlined into the browser bundle — **never** a secret.
- `NEXT_PUBLIC_API_URL` is baked in at **build time**, so it must be the public
  API URL when building the web image (compose passes it as a build arg).
- Production **refuses to boot** with a default or short `JWT_SECRET`
  (`< 32` chars). Generate one with `openssl rand -hex 32`.

## 5. Deploying to production

```text
┌──────────┐   ┌───────────────┐   ┌──────────────────┐
│ CDN/Edge │──►│ web (Next.js) │──►│ api (NestJS)     │
└──────────┘   └───────────────┘   └────────┬─────────┘
                                            ▼
                                   ┌──────────────────┐
                                   │ managed Postgres │
                                   └──────────────────┘
```

1. Provision a managed Postgres 16 database; keep automated backups on.
2. Deploy `apps/api` (container or platform build) with migrations as a release
   step: `npm run db:deploy`. Never run `migrate dev` in production.
3. Deploy `apps/web` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` set
   **at build time**.
4. Restrict CORS: `CORS_ORIGINS=https://drillke.com`.
5. Enable uptime checks on `/api/health/ready` and `/api/health`.
6. Verify `sitemap.xml`, `robots.txt` and canonical URLs.
7. Run the worker (`node apps/api/dist/main.js` with `EMBED_WORKER=true`, or a
   dedicated service running `node apps/api/dist/workers/youtube-sync.worker.js`).

### Release checklist

- [ ] `npm run build` green locally
- [ ] Migrations reviewed and applied with `db:deploy`
- [ ] Secrets rotated if any was ever exposed
- [ ] Smoke: home → search → song → play → lyrics highlight → admin login
- [ ] Rollback plan: previous image tag + a forward-only migration

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `P1001: Can't reach database server` | Postgres not up / wrong host | Start the stack (`npm run stack:up`); inside the container use `localhost`, from another container use the service name |
| `P3009: failed migrations` | A migration failed halfway | Inspect with `prisma migrate status`, fix forward |
| API boots then dies in prod | Weak/default `JWT_SECRET` | Set a ≥ 32-char secret |
| Lyrics never highlight | YouTube iframe blocked / not playing | Check embed permissions; synced UI requires a playing player |
| Web can't reach API in Docker | `NEXT_PUBLIC_API_URL` baked as `localhost` | Rebuild web with the browser-reachable URL |
| Port already in use | Another checkout running | `npm run stack:down` in the other checkout, or change `*_PORT` in `infra/.env` |

More local troubleshooting (including container health and log inspection):
[`runbook.md`](./runbook.md).
