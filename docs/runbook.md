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
in `.env` — see [Ports and configuration](#ports-and-configuration)).

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
npm run dev:stack:bg       # start in the background and return to the prompt
npm run dev:stack:ps       # container status
npm run dev:stack:logs     # tail api + web
npm run dev:stack:restart  # re-create api + web (needed after editing .env)
npm run dev:stack:install  # re-run npm ci in the shared volume, by hand
npm run dev:stack:down     # STOP (database data is kept)
npm run dev:stack:reset    # stop and delete the database volume
```

### Starting a stopped stack

`npm run dev:stack:bg` (or `docker compose ... up -d`) is always safe. Docker
Desktop's **Start** button also works, but note what it starts: every container
in the project, including the one-shot `install` job. That job re-exits 0 — it
only reinstalls when `package-lock.json` or a package manifest changed — and it
is set up to exit cleanly under Desktop's Start (an init process, and the
manifests are checked before anything is installed). If Start reports
`context canceled`, run `npm run dev:stack:bg` instead; it re-creates whatever
is missing instead of re-starting it in place.

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

**There is one environment file: `.env` at the repo root.** Both stacks and host
development read it. There is no `infra/.env` and no `.env.local` any more.

```powershell
Copy-Item .env.example .env     # once per checkout; .env is git-ignored
```

How each runner finds it:

| Runner | Where the values come from |
|---|---|
| `npm run dev:stack` / `stack:*` | Compose reads `.env` as the project dotenv file AND passes it into the api and web containers via `env_file`. Works the same when you call `docker compose -f infra/...` by hand. |
| `npm run dev` (web) | Next.js reads `.env` from the repo root. |
| `npm run dev:api` (api) | `apps/api/src/common/load-env.ts` loads the nearest `.env` at boot. |

> **Changed a value? Restart.** Environment is read when a container is
> created, not on every request. `npm run dev:stack:restart` (or `up -d`).

Key groups (full annotated list in [`.env.example`](../.env.example)):

| Key | Default | Notes |
|---|---|---|
| `WEB_PORT` / `API_PORT` / `DB_PORT` | `3000` / `4000` / `5432` | Ports on your machine (Docker only) |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `drillke` | Database inside the backend container |
| `JWT_SECRET` | dev placeholder | ≥ 32 chars; **change before exposing anything publicly** |
| `CORS_ORIGINS` | `http://localhost:3000` | Must match the web origin |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@drillke.local` / `change-me-now` | The first **admin** account. Password ≥ 10 chars or the seed refuses to run and no admin exists |
| `SEED_ADMIN_RESET_PASSWORD` | `true` | Re-applies the password and admin role on boot. Set `false` after setup |
| `SEED_ON_START` | `true` | Set `false` to stop re-seeding on every restart |
| `YOUTUBE_API_KEY` | *(empty)* | **Required to add an artist from a YouTube link.** See [YouTube import](#youtube-import) |
| `EMBED_WORKER` | `false` | Periodic new-upload sync inside the API process |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Baked in at **build** time |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Baked in at **build** time |

> `NEXT_PUBLIC_*` values are compiled into the browser bundle. In the dev stack
> they are read when the container starts; in the production-shaped stack you
> must rebuild the web image after changing them (`npm run stack:up`).

### Signing in as the admin

The seed creates the first admin from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD`. Sign in at `/sign-in` (server route:
`POST /api/auth/sign-in` with `{ email, password }`), then open `/admin`.

- The password must be **at least 10 characters**. A shorter one makes
  `prisma/seed.mjs` refuse to run; the entrypoint logs
  `seed skipped … continuing` and the app still starts — with no admin.
- An existing account keeps its old password unless
  `SEED_ADMIN_RESET_PASSWORD=true`, which re-applies the password and the admin
  role on every boot. Set it `true` while setting up, `false` afterwards.
- To check what the API actually sees:
  `docker exec drill-lyrics-key-dev-api printenv SEED_ADMIN_EMAIL`, and read
  the two `Bootstrap` lines the API logs at start-up (API key configured or
  missing, and which admin account the seed manages).

Connect to the database from your host:

```powershell
psql -h localhost -p 5432 -U drillke -d drillke
# password: drillke (unless changed)
```

---

## YouTube import

Adding an artist from a link is the acquisition path: **one link, the whole
channel.** Paste a channel (`@handle`, `/channel/UC…`, `/c/`, `/user/`) or any
video URL (the artist is the video's channel) into the admin screen.

### What has to be true for it to work

1. `YOUTUBE_API_KEY` is set in `.env`, and the api container was **re-created**
   after you set it (`npm run dev:stack:restart`). Editing `.env` on a running
   stack does nothing.
2. The key belongs to a Google Cloud project with **YouTube Data API v3**
   enabled. A key with the API disabled answers `403`.
3. Quota is not exhausted. The daily allowance is 10,000 units; the importer
   now batches (`videos.list` takes 50 ids per call, one unit), so a
   1,000-upload channel costs roughly 40 units.

Check the first two without opening the UI:

```powershell
docker exec drill-lyrics-key-dev-api printenv YOUTUBE_API_KEY   # must print a key
# → the API also logs "YouTube Data API key: configured" at boot
```

And from the admin screen, use **Preview** on the link before adding it: it
resolves the channel and lists its newest uploads without creating anything.

### What the import does

- Walks the channel's uploads playlist from newest to oldest, uploading every
  page's position as it goes. A failure part-way (quota, network) keeps
  everything already imported and resumes from the page that failed on the
  next sync.
- Songs are matched by `youtubeVideoId`, so re-running a sync never duplicates
  a song and the command is safe to repeat.
- Uploads that carry YouTube's **Music** category, or that classify as a song
  from duration and wording, become `draft` songs in the catalogue's review
  queue (`Song imports` in `/admin`).
- Anything not clearly music (a vlog, a caption-shaped event post, a festival
  or live-set recording) is still imported, as an `unclear` **review
  candidate**, and counted as skipped. It never enters the public catalogue on
  its own. Shorts, live streams and sub-30-second clips are not imported.
- A run of 25 non-music uploads in a row pauses the walk: that is what pointing
  the importer at a non-music channel looks like. **Import every upload**
  (`importAll`) overrides the pause for that channel.

### Buttons in /admin → Channels

| Button | Does |
|---|---|
| **Sync whole channel** | Continue an unfinished walk from where it stopped. |
| **Re-check whole channel** | Start again from the newest upload (`restart: true`). Correct after an earlier, now-fixed import that finished without importing anything. |
| **Import every upload** | Shown when the walk paused. Overrides the non-music filter. |
| **Review N drafts** | Jumps to the imported songs waiting for review. |

Only one sync per channel can run at a time. A second request answers
`409 This channel is already being imported` rather than racing the first one
and corrupting its cursor.

### New uploads after the artist is on file

Set `EMBED_WORKER=true` to let the API poll every `INGEST_INTERVAL_MS` (default
15 minutes) and pick up uploads published since the last sync. Without it,
pressing **Sync whole channel** is the only way to see new uploads.

### When the import looks wrong

| Symptom | Cause / fix |
|---|---|
| `YouTube channel verification needs a YouTube Data API key` | `YOUTUBE_API_KEY` is empty in the container. Set it in `.env`, `npm run dev:stack:restart`, re-check with `printenv`. |
| `YouTube rejected the API key or its quota is exhausted` | Key wrong, API not enabled on the project, or the daily quota is spent. |
| Import finishes with `0 new songs` | Every upload was already imported, or the channel is not a music channel and the filter rejected the rest. Try **Import every upload**. |
| `This channel is already being imported` | A sync is still running. Watch it with `npm run dev:stack:logs`. |
| Songs showed up, but none are public | Imports are **drafts** by design. Publish them from `/admin` → Song imports. |

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
| Docker Desktop **Start** exits 1 / `context canceled` | Start re-starts every container in the project, including the one-shot `install` job. Use `npm run dev:stack:bg`, which re-creates what is missing. |
| `[install] FAILED: could not install dependencies` | `npm ci` failed (network, registry auth, or a missing `package-lock.json`). The volume is left un-stamped so the next start retries; fix the cause and run `npm run dev:stack:install`. |
| A setting from `.env` has no effect | The container was not re-created. `npm run dev:stack:restart`, then confirm with `docker exec drill-lyrics-key-dev-api printenv <KEY>`. |
| Added an artist, but no songs appear | Check `YOUTUBE_API_KEY` reached the container and that the import was not paused. `/admin` → Channels shows the last error per channel. |
| API restarts in a loop | `npm run dev:stack:logs` — usually a TypeScript error, a bad `DATABASE_URL`, or a failed migration. |
| `/api/health/ready` returns 503 | PostgreSQL inside the backend container has not finished starting. Wait for `start_period` (60s) and re-check the logs. |
| `web` never starts | It waits for `install`; check that job exited `0`. |
| Edits do nothing (API) | `tsc --watch` needs polling over bind mounts — configured in `apps/api/tsconfig.json` under `watchOptions`. Don't remove it. |
| Edits do nothing (web) | Confirm you are on the **dev** container (`drill-lyrics-key-dev-web`). The production-shaped web serves a compiled build and never hot-reloads. |
| `port is already allocated` | Another stack or a local Postgres is running. Stop it (`npm run dev:stack:down` / `npm run stack:down`) or change `*_PORT` in `.env`. |
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

## Content import / export

Bulk lyrics authoring goes through Markdown files in `content/`.

```powershell
npm run content:export               # published songs → content/<artist>/<song>.md
npm run content:import -- --dry-run  # report what would change, write nothing
npm run content:import               # changed files → pending submissions
```

Rules worth knowing before running import:

- Import **never publishes**. A changed file becomes a pending submission that a
  moderator still has to approve, exactly like a contribution from the site.
- A file that matches the published version produces nothing, so the command is
  safe to run repeatedly.
- A song is matched by `youtubeVideoId`. A file for a video that is not a
  published catalogue song is skipped with a warning — import does not create
  songs or artists.
- Export is generated. Do not hand-edit the output and expect it to be preserved;
  edit the lyrics through review, then re-export.

Run against the Docker database with the dev stack:

```powershell
docker compose -f infra/docker-compose.dev.yml exec api npm run content:export
```

---

## Email — notifications, password reset, deletion

Review outcomes email the contributor when the submission is account-linked.
Password reset and account deletion always email the account's address.

| `MAIL_PROVIDER` | Behaviour |
|---|---|
| `mock` (default) | Logs a `mail to=… subject=…` line and the body at debug level; sends nothing |
| `smtp` | Sends through `nodemailer` using the settings below |

With the mock provider, the whole message is in the log — including the reset
link, which is the only way to follow one locally:

```powershell
docker compose -f infra/docker-compose.dev.yml logs api | Select-String "reset-password"
```

### Configuring SMTP

Set these in `.env` (dev) or your deploy environment (production), then
recreate the API container — `docker compose ... up -d` picks up env changes;
`restart` does not.

| Variable | Notes |
|---|---|
| `MAIL_PROVIDER` | `smtp` |
| `SMTP_HOST` | e.g. `smtp.postmarkapp.com`, `email-smtp.eu-west-1.amazonaws.com`, `mailhog` |
| `SMTP_PORT` | Defaults to 587. `465` implies implicit TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | Both or neither. Omit both for a relay with no auth |
| `MAIL_FROM` | Envelope sender, must contain an address: `DrillKe <no-reply@drillke.com>` |
| `SMTP_SECURE` | Optional override of the port inference (`true` / `false`) |
| `SMTP_ALLOW_INVALID_CERT` | `true` only for a self-signed local relay |
| `NEXT_PUBLIC_SITE_URL` | Reset links are built from it — **must be the real public origin in production** |

An incomplete configuration is refused, never silently ignored:

- **Production:** `validateEnv` fails the boot with the missing keys listed.
- **Any environment:** the API still starts, but `MailService.verify()` logs
  `SMTP connection check failed: …` and each send returns
  `delivered: false` with the reason.

```powershell
# Is mail configured and reachable?
docker compose -f infra/docker-compose.dev.yml logs api | Select-String "Mail provider|SMTP connection"
```

### Testing the flows without a mail server

Keep `MAIL_PROVIDER=mock` and read the link from the log:

```powershell
docker compose -f infra/docker-compose.dev.yml logs api | Select-String "reset-password/" | Select-Object -Last 1
```

Then open `http://localhost:3000/reset-password/<token>`. The link works once;
opening it again says it is invalid, which is the intended behaviour.

The same applies to confirmation links (sent on sign-up):

```powershell
docker compose -f infra/docker-compose.dev.yml logs api | Select-String "confirm-email/" | Select-Object -Last 1
```

Open `http://localhost:3000/confirm-email/<token>`. A second visit reports
"already confirmed" — that is not an error.

### Account page tools

Signed-in users have three self-service actions on `/account`, and none of them
needs an operator:

| Action | Endpoint | Notes |
|---|---|---|
| Resend confirmation | `POST /api/auth/confirmation/resend` | Shown only while unconfirmed |
| Download data | `GET /api/auth/export` | JSON; no passwords or token hashes |
| Delete account | `POST /api/auth/delete-account` | Password-confirmed; audited |

Unconfirmed accounts can still browse and submit lyrics — confirmation is a soft
gate in v1, not a wall.

`npm run smoke:account-flows` checks the API side of the same flows (non-
enumerable request, token stored, forged token refused, superseded link, password-
confirmed deletion, cascade) against a live stack, with no mail server and no
credentials — it creates and deletes its own throwaway account.

Every review notification is also recorded in the audit log as
`lyrics.notification_sent`, `lyrics.notification_skipped` (guest submission) or
`lyrics.notification_failed`, so a missing email is always traceable to a reason.
Password reset and deletion write `account.password_reset_requested`,
`account.password_reset_completed` and `account.deleted`.

---

## End-to-end tests

The Playwright suite drives the real app, so it needs a running stack (Postgres,
API and web) and the seeded admin account. It does **not** boot anything itself.

```powershell
npm run dev:stack                      # or npm run stack:up for the production-shaped stack
npx playwright install chromium        # once per machine

$env:E2E_ADMIN_PASSWORD = '<the seeded admin password>'
npm run test:e2e
```

| Variable | Default | Meaning |
|---|---|---|
| `E2E_WEB_URL` | `http://localhost:3000` | Web origin under test |
| `E2E_API_URL` | `http://localhost:4000` | API origin for fixtures and readiness |
| `E2E_ADMIN_EMAIL` | `admin@drillke.local` | Seeded admin (`SEED_ADMIN_EMAIL`) |
| `E2E_ADMIN_PASSWORD` | — | Seeded admin password; the suite **skips** without it |
| `E2E_SONG_SLUG` | `masicka-update-official-video` | Published song the fixture submits against |

Without a reachable API or without `E2E_ADMIN_PASSWORD`, every test skips with
the reason rather than failing, so a machine without Docker still runs
`npm run test` and `npm run typecheck` cleanly. `npm run test` (unit tests) does
**not** run the e2e suite.

---

## Removing every trace

```powershell
# Dev stack: containers, network, node_modules + .next + database volumes
npm run dev:stack:reset

# Production-shaped stack
docker compose -f infra/docker-compose.yml down -v --rmi local
```
