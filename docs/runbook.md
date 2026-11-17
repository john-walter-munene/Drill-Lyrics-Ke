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

DrillKe uses its own port range so it can run alongside the other projects on
this machine (The Expertise Wins: 3200/3201/5441, AppKings Voting:
3300/3301/5442) without one stopping the other.

| Service | URL |
|---|---|
| Frontend | <http://localhost:3100> |
| API readiness (API **and** database) | <http://localhost:4100/api/health/ready> |
| API liveness (process only) | <http://localhost:4100/api/health> |
| PostgreSQL (from your host) | `localhost:5440` |

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
Invoke-RestMethod http://localhost:4100/api/health/ready
# → {"status":"ok","checks":{"database":"ok"},"timestamp":"..."}

# Frontend
(Invoke-WebRequest -UseBasicParsing http://localhost:3100).StatusCode
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
development read it. Do not create `infra/.env`, `.env.local`, or per-app env
files — none of them is read, and a value set there is silently ignored. Compose
passes the same file to both containers, so every key in it reaches the API and
the web app without being repeated in a compose file.

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
| `WEB_PORT` / `API_PORT` / `DB_PORT` | `3100` / `4100` / `127.0.0.1:5440` | Ports on your machine (Docker and host development). Unique to DrillKe |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `drillke` | Database inside the backend container |
| `JWT_SECRET` | dev placeholder | ≥ 32 chars; **change before exposing anything publicly** |
| `CORS_ORIGINS` | `http://localhost:3100` | Must match the web origin |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@drillke.local` / `change-me-now` | The first **admin** account. Password ≥ 10 chars or the seed refuses to run and no admin exists |
| `SEED_ADMIN_RESET_PASSWORD` | `true` | Re-applies the password and admin role on boot. Set `false` after setup |
| `SEED_ON_START` | `true` | Set `false` to stop re-seeding on every restart |
| `YOUTUBE_API_KEY` | *(empty)* | **Required to add an artist from a YouTube link.** See [YouTube import](#youtube-import) |
| `YOUTUBE_AUTO_PUBLISH` | `true` | Imported **music** uploads go straight into the public catalogue (`false` = leave them as drafts to review) |
| `EMBED_WORKER` | `false` | Periodic new-upload sync inside the API process |
| `YOUTUBE_WORKER_PAGES` | *(all)* | Optional cap, in pages of 50, on one periodic cycle per channel |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4100` | Baked in at **build** time |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3100` | Baked in at **build** time |

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
psql -h localhost -p 5440 -U drillke -d drillke
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

One link is the whole catalogue, and it is visible when the request returns.

- Walks the channel's uploads playlist from newest to oldest, saving the walk's
  position after every page. A failure part-way (quota, network) keeps
  everything already imported and the next sync resumes at the page that failed.
- Songs are matched by `youtubeVideoId`, so re-running a sync never duplicates
  a song and the command is safe to repeat.
- Uploads that carry YouTube's **Music** category, are topic-channel tracks, or
  classify as a song from duration and wording are imported **and published**:
  they appear on the artist page, on `/songs` and on the home shelves
  (`YOUTUBE_AUTO_PUBLISH=false` keeps them as drafts instead).
- Anything not clearly music (a vlog, a caption-shaped event post, a festival
  or live-set recording) is still imported, as an `unclear` **review
  candidate** under `/admin` → Song imports, and counted as skipped. It never
  enters the public catalogue on its own. Shorts, live streams and sub-30-second
  clips are not imported.
- A **scheduled premiere** is handled by date, not by YouTube's live flag: once
  its publish date has passed it is a released song and is imported. One still
  waiting for its premiere is skipped and counted in `awaitingRelease`; the next
  sync picks it up.
- A run of non-music uploads does **not** stop the walk. It used to, which left
  the rest of the channel unimported and kept re-reading the same page; the
  filter now only decides what is published, and **Import every upload**
  (`importAll`) adds the unclear uploads too.
- When something is published, the API tells the web app to drop its cached
  catalogue pages (`POST /api/revalidate`), so new songs show up immediately
  instead of after the 2–5 minute page cache.
- An artist's page exists from the moment they are added, even before the first
  song arrives — the importer and the directory no longer hide it.

### Buttons in /admin → Channels

| Button | Does |
|---|---|
| **Sync whole channel** | Continue an unfinished walk from its saved page, or re-read a finished one for new uploads. |
| **Re-check whole channel** | Start again from the newest upload (`restart: true`). Use it after fixing an import problem: songs are matched by video id, so nothing is duplicated. |
| **Import every upload** | Shown when a channel had unclear uploads. Also imports those as review candidates. Never imports a short or a live stream. |
| **See videos in the app** | Lists everything imported for that channel — published included — so "did the whole catalogue come in?" has an answer. |
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
| `YouTube channel verification needs a YouTube Data API key` | `YOUTUBE_API_KEY` is empty in the container. Set it in the repo-root `.env`, `npm run dev:stack:restart`, re-check with `printenv`. |
| `YouTube rejected the API key or its quota is exhausted` | Key wrong, API not enabled on the project, or the daily quota is spent. |
| Import finishes with `0 new songs` | Every upload was already imported, or the channel is not a music channel and the filter rejected the rest. Try **Import every upload**. |
| `This channel is already being imported` | A sync is still running. Watch it with `npm run dev:stack:logs`. |
| Songs showed up, but none are public | Either `YOUTUBE_AUTO_PUBLISH=false`, or the uploads were not confirmed as music (they are drafts by design). Publish them from `/admin` → Song imports. |
| One song of a release is missing | If it premiered as a scheduled video, it is imported once its publish date has passed. Press **Re-check whole channel**; the import summary reports anything still awaiting release. |
| Artist added, but nothing in the app | Open `/admin` → Artists & sync → **See videos in the app**: an empty list means nothing was imported (check `lastError`). The public page shows drafts only once published. |

---

## Seeding

There are two seeds. Both are idempotent — re-running one replaces what it
created rather than duplicating it.

| Command | Creates |
|---|---|
| `npm run db:seed` | The admin account, a placeholder artist, DJ, podcast, event and a handful of playback-test songs |
| `npm run db:seed:competition` | A finished three-stage playlist competition: 8 playlists, 3 closed stages, a winner, a committee with one removed member |

```powershell
# Host, against the database in .env
npm run db:seed
npm run db:seed:competition

# Inside the dev stack
npm run dev:stack:bg
docker compose -f infra/docker-compose.dev.yml exec api npm run db:seed:competition
```

Both need `SEED_ADMIN_PASSWORD` (≥ 10 characters) in `.env`. The seed refuses to
run without it, and the entrypoint logs `seed skipped … continuing` — the app
still starts, with no admin.

### Seeding your own competition

`prisma/seed-competition.template.mjs` is a copy-and-edit seed. Everything you
normally change is in one `CONFIG` block at the top: the slug, the playlists,
the three stages with their vote counts, and the committee.

```powershell
Copy-Item prisma/seed-competition.template.mjs prisma/seed-my-cup.mjs
# edit the CONFIG block
node prisma/seed-my-cup.mjs
```

The template validates the config before writing anything, and says what is
wrong rather than failing on a foreign key:

```text
Invalid competition config:
  - semifinal: votes for "not-an-entrant", which is not an entrant
```

Things worth knowing when editing it:

- **`advancing`** is how many entrants move on. Use `0` for the final, which
  produces the winner instead.
- **`entrants`** on the first stage can be omitted to use every entry. On later
  stages, list the advancers — the seed does not compute them, so a typo here is
  a bracket that does not match the votes.
- **`votes`** is the final tally. The seed creates that many distinct voters, so
  the numbers you write are the numbers the page shows.
- **`status`** — `results_published` for a finished competition, `voting_open`
  to leave the last stage open, `draft` to keep it off the public list.
- The seed writes stages as **already closed**. To exercise the live flow
  (open → vote → close → tiebreak) use the smoke test below instead.

### Testing the voting flow end to end

`npm run smoke:competition` drives a fresh competition from draft to a declared
winner against a running API. It creates its own accounts and competition and
deletes them afterwards.

```powershell
npm run dev:stack:bg
$env:SEED_ADMIN_PASSWORD = '<the seeded admin password>'
npm run smoke:competition
```

It checks the rules that are easy to get wrong: a stage cannot open before the
previous one closes, a stage with no votes cannot close, a tie across the cut
blocks the next stage until an admin resolves it, a second vote is refused, and
the quarterfinal and semifinal stay readable after the final.

---

## Competition voting

A competition runs quarterfinal → semifinal → final. Nothing advances on a
timer: an admin opens a stage, people vote, an admin closes it, and the
advancers become the next stage's entrants.

### Running one

1. Seed or create the competition (`npm run db:seed:competition` for the demo).
2. Open `/competitions/<slug>` as an admin. The **Organiser controls** panel is
   at the bottom of the page.
3. **Open voting** on the quarterfinal. It needs at least two entrants.
4. When voting is done, **Close voting**. The result is published immediately.
5. **Open voting** on the semifinal. Its entrants are the quarterfinal's
   advancers, carried forward automatically.
6. Repeat for the final. Closing the final declares the winner.

### The committee

Committee members are appointed per competition by an admin, by email. They are
ordinary accounts — the appointment is not a site role.

- **Add** — enter the account's email and a role (`member` or `chair`).
- **Remove** — a soft delete. The row stays, so the member's past votes remain
  attributable, and the removal reason is kept. Re-adding the same email
  restores the membership.
- A removed member can no longer vote in a committee-only competition.

Every appointment, removal, stage change, tiebreak and invalidation is written
to the audit log (`/admin` → Audit).

### Ties

Ties are never broken automatically. Equal votes share a rank, and a tie that
straddles the advancing cut is shown on the results page and blocks the next
stage. The organiser resolves it in **Organiser controls** by choosing who
advances and giving a reason; the decision is published on the stage and
recorded in the audit log.

### The device rule

Live, a vote is bound to one device per account. The browser keeps a random
token in `localStorage` and the API stores only its hash.

- The rule applies **only when a device token is presented**, so seeded and test
  votes still work.
- A browser that blocks storage votes without one.
- **Clearing site data presents a new device.** If that matters for a
  competition, use `voterScope: 'account'` or `'committee'` — those bind the
  vote to the account, and the device rule is an additional check on top.

### Checking a result

- The public page shows every stage with each entrant's votes, share, rank and
  outcome — including the eliminated ones.
- `GET /api/competitions/:slug/stages/:stageId/votes` (admin) is the ledger:
  who voted, for what, and whether it counted.
- An invalidated vote stops counting everywhere but stays in the ledger.

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

Smoke tests need a running stack and a database. Each creates and deletes its
own fixtures:

| Command | Needs | Checks |
|---|---|---|
| `npm run smoke:competition` | API + `SEED_ADMIN_PASSWORD` | Three-stage voting, committee add/remove, ties, the winner |
| `npm run smoke:account-flows` | API | Sign-up, reset, confirmation, deletion |
| `npm run smoke:confirmation-export` | API | Confirmation links and data export |
| `npm run smoke:sync-estimate` | API | Server-side lyric sync estimation |

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
| `P1000 Authentication failed` from Prisma | Something else owns the port in `DATABASE_URL` — commonly a native PostgreSQL service on 5432 shadowing the Docker container. Check with `Get-NetTCPConnection -LocalPort 5432 -State Listen`, then point `DATABASE_URL` at a free port. |
| Competition page 404s | The competition is `draft`. Drafts are hidden from everyone but staff. |
| "Close the quarterfinal before opening this stage" | Stages open in order. Close the previous one first. |
| "The quarterfinal is tied across its cut line" | Resolve the tie in **Organiser controls** before opening the next stage. |
| "You have already voted in this stage" | One vote per voter per stage. Set `allowVoteChange` on the competition to permit a change. |
| "This account has already voted from another device" | The device rule. The account voted from a different browser; clear it by invalidating the vote in the ledger, or use `voterScope: 'account'`. |
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
npm run dev                     # web → http://localhost:3100
npm run dev:api                 # api → http://localhost:4100
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

Then open `http://localhost:3100/reset-password/<token>`. The link works once;
opening it again says it is invalid, which is the intended behaviour.

The same applies to confirmation links (sent on sign-up):

```powershell
docker compose -f infra/docker-compose.dev.yml logs api | Select-String "confirm-email/" | Select-Object -Last 1
```

Open `http://localhost:3100/confirm-email/<token>`. A second visit reports
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
| `E2E_WEB_URL` | `http://localhost:3100` | Web origin under test |
| `E2E_API_URL` | `http://localhost:4100` | API origin for fixtures and readiness |
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
