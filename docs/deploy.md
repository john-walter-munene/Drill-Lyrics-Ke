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

Everything the app needs lives in `infra/`.

### 2a. Development stack (hot-reload, isolated)

The dev stack runs api + web inside containers with bind-mounted source files so edits reload instantly. The database and `node_modules` live in named Docker volumes, keeping your host OS clean.

```bash
cp .env.example .env            # defaults are fine; no edits required for dev

npm run dev:stack               # first run: builds image, installs deps, runs migrations, seeds
#  web → http://localhost:3000
#  api → http://localhost:4000/api/health/ready
```

```bash
npm run dev:stack:down          # stop (data preserved in volumes)
npm run dev:stack:reset         # stop + wipe volumes (fresh DB)
npm run dev:stack:logs          # tail live api + web output
npm run dev:stack:bg            # same as dev:stack but detached
```

**Isolation guarantees:**
- Compose project name is pinned to `drillke-dev` — containers can't collide with other checkouts.
- Host ports are overridable via `.env.local`: `WEB_PORT`, `API_PORT`, `DB_PORT`, `REDIS_PORT`.
- Only source is bind-mounted; `node_modules` is a Docker named volume (Linux-native, fast).
- App runs as the non-root `node` user inside the container.

### 2b. Database only (fastest local inner loop)

Run Postgres + Redis in Docker, then the apps natively on your machine:

```bash
npm run db:up                   # Postgres :5433 · Redis :6380
npm run prisma:migrate
npm run db:seed
npm run dev                     # web  :3000
npm run dev:api                 # api  :4000
```

### 2c. Full production-like stack

```bash
npm run stack:up                # web :3000 · api :4000 · postgres :5432 · redis :6379
npm run stack:down
```

### 2d. Building Docker images directly

You can build all or individual images with npm scripts:

```bash
npm run docker:build            # build all three images: dev, api, web
npm run docker:build:dev        # build dev/tooling image (infra/Dockerfile.dev)
npm run docker:build:api        # build production API image (Dockerfile)
npm run docker:build:web        # build production web image (apps/web/Dockerfile)
```

### 2e. Containerized verification (CI in a container)

Run lint, typecheck and test inside the Linux dev container without host dependencies:

```bash
npm run docker:check            # runs typecheck + test + lint in the dev container
npm run docker:test             # run unit tests in container
npm run docker:typecheck        # run TypeScript check in container
npm run docker:lint             # run lint in container
```

### What is containerised, and why

| Service | Image | Purpose |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Database. Healthcheck gates dependants. |
| `redis` | `redis:7-alpine` | Reserved for rate-limit/cache sharing across instances. |
| `api` | `infra/Dockerfile.dev` (dev) / `Dockerfile` (prod) | NestJS; also runs the worker via command override. |
| `web` | `apps/web/Dockerfile` | Next.js standalone server. |

Isolation choices that prevent collisions:

- **Named volumes** (`drillke-pgdata`, `drillke-redisdata`) — data survives
  rebuilds, `stack:down -v` resets deliberately.
- **Fixed container names** (`drillke-postgres`, `drillke-api`, …) — a second
  checkout of the repo fails loudly on a port/name clash instead of silently
  talking to the wrong database.
- **Explicit env in compose**, not a shared `.env` — the containers do not read
  your local `.env`, so a dev secret can never leak into a shared environment.
- **Containers use service DNS** (`postgres:5432`), never `localhost`.


## 3. Local (without Docker)

```bash
npm install
cp .env.example .env          # edit secrets if needed
npm run db:up                 # or point DATABASE_URL at any Postgres 16+
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
| `P1001: Can't reach database server` | Postgres not up / wrong host | `npm run db:up`; inside Docker use `postgres`, not `localhost` |
| `P3009: failed migrations` | A migration failed halfway | Inspect with `prisma migrate status`, fix forward |
| API boots then dies in prod | Weak/default `JWT_SECRET` | Set a ≥ 32-char secret |
| Lyrics never highlight | YouTube iframe blocked / not playing | Check embed permissions; synced UI requires a playing player |
| Web can't reach API in Docker | `NEXT_PUBLIC_API_URL` baked as `localhost` | Rebuild web with the browser-reachable URL |
| Port already in use | Another checkout running | `npm run stack:down` in the other checkout |
