# 🚀 DrillKe Runbook

Everything runs in Docker. This is the complete operator guide: start, stop,
verify, configure and troubleshoot **both** stacks.

> New to the repo? Read this file, then [`deploy.md`](./deploy.md) for the
> production topology and [`architecture.md`](./architecture.md) for the code
> layout.

---

## The two stacks

Both stacks have the **same shape**: one backend container that owns both the
API and PostgreSQL, plus one frontend container.

| | Development | Production-shaped |
|---|---|---|
| Compose file | `infra/docker-compose.dev.yml` | `infra/docker-compose.yml` |
| Compose project | `drill-lyrics-key-dev` | `drill-lyrics-key` |
| Backend container | `drill-lyrics-key-dev-api` | `drill-lyrics-key-api-1` |
| Frontend container | `drill-lyrics-key-dev-web` | `drill-lyrics-key-web-1` |
| Image | `drillke-dev:latest` | `drillke-api:latest`, `drillke-web:latest` |
| Frontend | `next dev` (hot reload) | `next start` (compiled bundle) |
| Use it for | day-to-day coding | checking what will ship |

Both are reachable at the same URLs, so **run one at a time** (or change ports
in `infra/.env` — see [Ports](#ports-and-configuration)).

| Service | URL |
|---|---|
| Frontend | <http://localhost:3000> |
| API readiness (API **and** database) | <http://localhost:4000/api/health/ready> |
| API liveness (process only) | <http://localhost:4000/api/health> |
| PostgreSQL (from your host) | `localhost:5432` |

In Docker Desktop both appear as projects; expand a project to see its two
containers.

---

## Daily development

```powershell
npm run dev:stack        # build + start, logs stream until Ctrl+C
```

First run builds the image and installs dependencies **inside** the container
(a few minutes). After that, startup is fast: the `install` step is skipped
while `package-lock.json` and the package manifests are unchanged.

```powershell
npm run dev:stack:bg     # start in the background and return to the prompt
npm run dev:stack:ps     # container status
npm run dev:stack:logs   # tail api + web
npm run dev:stack:down   # STOP (database data is kept)
npm run dev:stack:reset  # stop and delete the database volume
```

### How hot reload works

The repo is bind-mounted into both containers at `/app`. Edit a file on your
machine and it changes inside the container immediately:

| Change | What happens |
|---|---|
| `apps/api/src/**` | `tsc --watch` recompiles, the runner restarts Node |
| `apps/web/**` | Next.js recompiles the route and refreshes the browser |
| `packages/shared/**` | Both sides pick it up on next compile |
| `prisma/schema.prisma` | Not automatic — see [Changing the schema](#changing-the-schema) |

`node_modules` lives in a named volume, not on your host, so the Linux-native
binaries the container installs are never overwritten by a host install.

> **Why not `tsx`?** Nest needs `emitDecoratorMetadata` for dependency
> injection. `tsx`/esbuild silently strips it, so every injected dependency
> becomes `undefined` and every route 500s. The API is compiled with `tsc`
> instead — the same compiler used in production. See
> `apps/api/scripts/dev-watch.js`.

---

## Production-shaped stack

Use this before opening a PR that touches build config, Dockerfiles or
environment handling. It runs the compiled artefacts, exactly like deployment.

```powershell
npm run stack:up         # build + start
npm run stack:ps         # both should report (healthy)
npm run stack:down       # stop (keeps data)
npm run stack:reset      # stop + wipe database
npm run stack:logs       # tail api + web
```

---

## Verify it is working

```powershell
# Both containers healthy?
npm run dev:stack:ps

# API + database
Invoke-RestMethod http://localhost:4000/api/health/ready
# → {"status":"ok","checks":{"database":"ok"},"timestamp":"..."}

# Frontend
(Invoke-WebRequest -UseBasicParsing http://localhost:3000).StatusCode
# → 200
```

### Watch the boot sequence

```powershell
npm run dev:stack:logs
```

On first boot the backend entrypoint prints, in order:

```text
[entrypoint] initialising PostgreSQL data directory at /var/lib/postgresql/data
[entrypoint] starting PostgreSQL
[entrypoint] ensuring role and database
[entrypoint] applying Prisma migrations
[entrypoint] seeding (set SEED_ON_START=false to skip)
[entrypoint] starting: npm run start:dev --prefix apps/api
```

then Nest's route table and `DrillKe API listening on :4000`.

---

## Ports and configuration

Defaults: web `3000`, API `4000`, database `5432`.

To change them, copy the example and edit:

```powershell
Copy-Item infra/.env.example infra/.env
```

Compose reads `infra/.env` automatically for **both** stacks. Full list in
[`infra/.env.example`](../infra/.env.example).

| Key | Default | Notes |
|---|---|---|
| `WEB_PORT` / `API_PORT` / `DB_PORT` | `3000` / `4000` / `5432` | Ports on your machine |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `drillke` | Database inside the backend container |
| `JWT_SECRET` | dev placeholder | **Change before exposing anything publicly** |
| `CORS_ORIGINS` | `http://localhost:3000` | Must match the web origin |
| `SEED_ON_START` | `true` | Set `false` to stop re-seeding on every restart |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Baked in at **build** time |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Baked in at **build** time |

> `NEXT_PUBLIC_*` values are compiled into the browser bundle. In the dev stack
> they are read when the container starts; in the production-shaped stack you
> must rebuild the web image after changing them (`npm run stack:up`).

Connect to the database from your host:

```powershell
psql -h localhost -p 5432 -U drillke -d drillke
# password: drillke (unless changed)
```

---

## Common tasks

```powershell
# Interactive shell in the backend container
docker compose -f infra/docker-compose.dev.yml exec api sh

# Run Prisma against the live dev database
docker compose -f infra/docker-compose.dev.yml exec api npx prisma migrate status --schema prisma/schema.prisma

# Inspect tables
docker compose -f infra/docker-compose.dev.yml exec api psql -U drillke -d drillke -tAc "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname"

# Re-seed without destroying anything
docker compose -f infra/docker-compose.dev.yml exec api npm run db:seed
```

### Changing the schema

The database is created on first boot from `prisma/migrations/`.

- **New migration added** → restart the backend; the entrypoint runs
  `prisma migrate deploy`.
- **Edited an existing migration / experimenting** → `npm run dev:stack:reset`
  to rebuild the database from scratch.

Never edit an already-applied migration in production — add a new one.

---

## Testing and checks

These run on your host (Node ≥ 22) and need no database:

```powershell
npm run typecheck     # TypeScript across all workspaces
npm test              # pure-logic unit tests
npm run lint
```

Run before every PR. They are what CI runs.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm run dev:stack` hangs on `[install] npm ci` | First run only. Later runs skip it. Check network/proxy if it stalls. |
| API restarts in a loop | `npm run dev:stack:logs` — usually a TypeScript error, a bad `DATABASE_URL`, or a failed migration. |
| `/api/health/ready` returns 503 | PostgreSQL inside the backend container has not finished starting. Wait for `start_period` (60s) and re-check the logs. |
| `web` never starts | It waits for `install`; check that job exited `0`. |
| Edits do nothing (API) | `tsc --watch` needs polling over bind mounts — configured in `apps/api/tsconfig.json` under `watchOptions`. Don't remove it. |
| Edits do nothing (web) | Confirm you are on the **dev** container (`drill-lyrics-key-dev-web`). The production-shaped web serves a compiled build and never hot-reloads. |
| `port is already allocated` | Another stack or a local Postgres is running. Stop it (`npm run dev:stack:down` / `npm run stack:down`) or change `*_PORT` in `infra/.env`. |
| Pages load but API calls fail | `NEXT_PUBLIC_API_URL` was wrong when built. Fix it, then `npm run stack:up` (rebuild) or restart the dev stack. |
| `initdb: not found` | The image is stale — rebuild: `npm run dev:stack` / `npm run stack:up`. |
| Want a clean slate | `npm run dev:stack:reset` then `npm run dev:stack`. |

Still stuck: `docker compose -f infra/docker-compose.dev.yml logs --tail 200 api`.

---

## Without Docker (optional)

Only if you have Node ≥ 22 and a Postgres 16 you can point at:

```powershell
npm install
Copy-Item .env.example .env     # edit DATABASE_URL
npm run prisma:migrate
npm run db:seed
npm run dev                     # web → http://localhost:3000
npm run dev:api                 # api → http://localhost:4000
```

---

## Removing every trace

```powershell
# Dev stack: containers, network, node_modules + .next + database volumes
npm run dev:stack:reset

# Production-shaped stack
docker compose -f infra/docker-compose.yml down -v --rmi local
```
