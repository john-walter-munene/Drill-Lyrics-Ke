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

> The dev stack shows **three** entries in Docker Desktop: `api`, `web` and a
> one-shot `install` job that runs `npm ci` into the shared `node_modules`
> volume when a manifest or `prisma/schema.prisma` changes, then exits 0. That
> job is a dev-only optimisation — ignore it. Only the development stack has
> it; the production-shaped stack below is exactly **two** containers.

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

For a local compose run, create the ignored environment file and replace the
example JWT secret before starting the production-mode containers:

```bash
cp .env.example .env
```

There is one environment file — `.env` at the repo root — and both stacks plus
host development read it. Compose picks it up as the project dotenv file and
also passes it into the api and web containers through `env_file`, so calling
`docker compose -f infra/...` by hand behaves the same as the npm scripts.

Keys: `WEB_PORT`, `API_PORT`, `DB_PORT`, `POSTGRES_*`, `DATABASE_URL` (host
development only), `JWT_SECRET`, `CORS_ORIGINS`, `MAX_BODY_SIZE`,
`SEED_ON_START`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_ADMIN_RESET_PASSWORD`, `YOUTUBE_API_KEY`, `EMBED_WORKER`,
`INGEST_INTERVAL_MS`, `MAIL_PROVIDER`, `SMTP_*`, `MAIL_FROM`,
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL`. The comments
in [`.env.example`](../.env.example) explain each one.

The seed password is what creates the initial **admin** account (`/admin`):
- it must be at least 10 characters, or the seed refuses to run and no admin
  account exists at all;
- keep `SEED_ADMIN_RESET_PASSWORD=false` for normal use. Set it to `true` only
  for an intentional admin password reset, re-create the API once so the seed
  runs, then set it back to `false` and re-create the API container again.
  Normal restarts do not rewrite an existing admin password.

Change the password and `JWT_SECRET` before exposing the app beyond localhost.

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
- **One env file, one place to look** — `.env` at the repo root, read by both
  stacks and by host development. Compose still declares its own network
  defaults (e.g. `DATABASE_URL` pointing at `localhost` inside the container),
  so a value in `.env` never has to describe the container's network.
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
- The API stores only session state, never the JWT itself. Auth cookies are
  HttpOnly and SameSite=Lax; sessions are revoked on sign-out and expire after
  14 days without activity.
- **`NEXT_PUBLIC_SITE_URL` must be the real public origin in production.** Password
  reset links are built from it; a `localhost` value ships links nobody can open.
- **Mail:** `MAIL_PROVIDER=mock` is a valid production choice (messages are
  logged, not sent) — but then a user who forgets their password has no way to
  recover the account, so set `smtp` before inviting real users. With `smtp`,
  production **refuses to boot** if `SMTP_HOST` or `MAIL_FROM` is missing, and the
  API logs an SMTP connection check after it starts listening.
- Reset and deletion routes are covered by the strict auth throttle; if traffic
  grows, raise `THROTTLE_AUTH_LIMIT` rather than removing the limit.

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
7. **Send one real email** (`/forgot-password` for the admin address) and follow
   the link end to end. A misconfigured `MAIL_FROM` domain fails only at send
   time, after the reset request has already been accepted.
8. Run the worker (`node apps/api/dist/main.js` with `EMBED_WORKER=true`, or a
   dedicated service running `node apps/api/dist/workers/youtube-sync.worker.js`).

### Release checklist

- [ ] `npm run build` green locally
- [ ] Migrations reviewed and applied with `db:deploy`
- [ ] Secrets rotated if any was ever exposed
- [ ] Smoke: home → search → song → play → lyrics highlight → admin login
- [ ] `npm run smoke:account-flows` green against the deployed API
- [ ] One real password-reset email received and the link followed
- [ ] Rollback plan: previous image tag + a forward-only migration

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `P1001: Can't reach database server` | Postgres not up / wrong host | Start the stack (`npm run stack:up`); inside the container use `localhost`, from another container use the service name |
| `P3009: failed migrations` | A migration failed halfway | Inspect with `prisma migrate status`, fix forward |
| API boots then dies in prod | Weak/default `JWT_SECRET` | Set a ≥ 32-char secret |
| Lyrics never highlight | YouTube iframe blocked / not playing | Check embed permissions; synced UI requires a playing player |
| Contributors get no email | `MAIL_PROVIDER` unset/`mock`, or guest submission | `mock` only logs; guests have no address. Check `lyrics.notification_*` in the audit log |
| Reset email never arrives | `MAIL_PROVIDER=mock`, SMTP misconfigured, or the address has no account | Check `Mail provider` / `SMTP connection check failed` in the API log. The API answers `accepted` either way by design, so the log is the only signal |
| Reset link opens a 404 or a localhost URL | `NEXT_PUBLIC_SITE_URL` was wrong when the link was generated | Set it to the public origin and request a new link (old ones are invalidated) |
| Prod boots with `SMTP_HOST is required…` | `MAIL_PROVIDER=smtp` with an incomplete config | Set `SMTP_HOST`, `MAIL_FROM` (and credentials if the relay needs them), or use `mock` |
| Web can't reach API in Docker | `NEXT_PUBLIC_API_URL` baked as `localhost` | Rebuild web with the browser-reachable URL |
| Port already in use | Another checkout running | `npm run stack:down` in the other checkout, or change `*_PORT` in `infra/.env` |

More local troubleshooting (including container health and log inspection):
[`runbook.md`](./runbook.md).
