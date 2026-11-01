#!/bin/sh
# DrillKe backend container entrypoint.
#
# The backend container is self-contained: it owns the PostgreSQL server that
# lives inside it, so `docker compose up` is the only command needed to get a
# working stack. On every boot this script:
#
#   1. initialises a data directory the first time it is created,
#   2. starts PostgreSQL and waits until it accepts connections,
#   3. ensures the application role + database exist,
#   4. applies Prisma migrations (and seeds, unless SEED_ON_START=false),
#   5. starts the process passed as the container command (the API).
#
# A data directory with no PG_VERSION is treated as "uninitialised" — this is
# the usual failure mode after a volume was created by a different user.
#
# Postgres runs under the system `postgres` user on a data directory owned by
# it (Postgres refuses to run as root, and the API process stays as non-root
# `node`). The volume is chowned once, on first boot.
set -eu

# Locate the PostgreSQL server binaries. Debian installs them in a versioned
# directory that is not on PATH, and the major version depends on the base
# image (bookworm ships 15; the PGDG repo would have given 16). Baked in at
# build time by the Dockerfile; fall back to probing in case it is missing.
if [ -f /etc/drillke-pg-bin ]; then
  PATH="$(cat /etc/drillke-pg-bin):$PATH"
else
  for dir in /usr/lib/postgresql/*/bin; do
    if [ -d "$dir" ]; then PATH="$dir:$PATH"; fi
  done
fi
export PATH

if ! command -v initdb >/dev/null 2>&1; then
  echo "[entrypoint] FATAL: PostgreSQL server binaries not found (initdb missing)" >&2
  echo "[entrypoint] install the 'postgresql' package or rebuild the image" >&2
  exit 1
fi

# Compose runs this as `entrypoint: ["/app/infra/docker-entrypoint.sh"]` with a
# bind-mounted repo at /app, so the data directory must live OUTSIDE that mount:
# a path under /app would be written into the host checkout and survive
# `down -v`. The images set this explicitly; this default is the same place.
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGPORT="${PGPORT:-5432}"
PG_DB="${POSTGRES_DB:-drillke}"
PG_USER="${POSTGRES_USER:-drillke}"
PG_PASS="${POSTGRES_PASSWORD:-drillke}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$PGDATA" /var/run/postgresql
  chown -R postgres:postgres "$PGDATA" /var/run/postgresql
fi

# Postgres binaries refuse to run as root, so always drop to `postgres`.
as_postgres() {
  if [ "$(id -u)" = "0" ]; then
    su postgres -s /bin/sh -c "$1"
  else
    sh -c "$1"
  fi
}

echo "[entrypoint] PostgreSQL data: $PGDATA ($(if [ -f "$PGDATA/PG_VERSION" ]; then echo "PG $(cat "$PGDATA/PG_VERSION")"; else echo uninitialised; fi))"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] initialising PostgreSQL data directory at $PGDATA"
  as_postgres "initdb -D '$PGDATA' -U postgres --auth-local=trust --auth-host=scram-sha-256 >/dev/null"
else
  # A data directory left by a different PostgreSQL major version cannot be
  # started (e.g. volume created by PSQL 16, image now ships Debian's 15).
  # Refuse loudly instead of letting pg_ctl retry in a restart loop, and say
  # exactly how to recover.
  data_major="$(cat "$PGDATA/PG_VERSION" 2>/dev/null || echo unknown)"
  bin_major="$(postgres --version 2>/dev/null | sed -n 's/.* \([0-9][0-9]*\).*/\1/p')"
  if [ -n "$bin_major" ] && [ "$data_major" != "$bin_major" ]; then
    echo "[entrypoint] FATAL: database files were created by PostgreSQL $data_major," >&2
    echo "[entrypoint]        but this image ships PostgreSQL $bin_major. They are not" >&2
    echo "[entrypoint]        compatible and the server will not start." >&2
    echo "[entrypoint] Fix: wipe the database volume and let it re-initialise + re-seed:" >&2
    echo "[entrypoint]   docker compose -f infra/docker-compose.yml down -v" >&2
    echo "[entrypoint]   docker compose -f infra/docker-compose.yml up -d --build" >&2
    exit 1
  fi
fi

echo "[entrypoint] starting PostgreSQL"
as_postgres "pg_ctl -D '$PGDATA' -o '-c listen_addresses=localhost -p $PGPORT' -l /tmp/postgres.log -w start >/dev/null" \
  || { tail -n 50 /tmp/postgres.log 2>/dev/null; exit 1; }

echo "[entrypoint] ensuring role and database"
as_postgres "psql -U postgres -p $PGPORT -v ON_ERROR_STOP=1 -c \"DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$PG_USER') THEN CREATE ROLE \\\"$PG_USER\\\" LOGIN PASSWORD '$PG_PASS'; ELSE ALTER ROLE \\\"$PG_USER\\\" WITH LOGIN PASSWORD '$PG_PASS'; END IF; END \\\$\\\$;\" >/dev/null"
as_postgres "psql -U postgres -p $PGPORT -v ON_ERROR_STOP=1 -tAc \"SELECT 1 FROM pg_database WHERE datname = '$PG_DB'\" | grep -q 1 || createdb -U postgres -p $PGPORT -O '$PG_USER' '$PG_DB'"

# Migrations run as the app role against the app database.
export DATABASE_URL="${DATABASE_URL:-postgresql://$PG_USER:$PG_PASS@localhost:$PGPORT/$PG_DB?schema=public}"

# The Prisma client is generated at IMAGE-BUILD time, so any schema change made
# after the image was built (e.g. a new model) is missing from node_modules.
# Without this, `migrate deploy` applies the SQL but the compiled code fails to
# type-check against the stale client and the API silently serves the last
# build. Cheap (~1s) and idempotent, so run it on every boot, before migrating.
#
# The workspace root is the directory that holds prisma/. Both images put it at
# /app; this resolves it rather than assuming, so a different workdir cannot
# turn a container start into a restart loop over "schema not found".
if [ -f /app/prisma/schema.prisma ]; then
  APP_ROOT=/app
elif [ -f ./prisma/schema.prisma ]; then
  APP_ROOT=.
else
  APP_ROOT=$(dirname "$(dirname "$(readlink -f "$0")")")
fi
cd "$APP_ROOT"

# Use the installed Prisma CLI, never `npx prisma`: on a slow or offline network
# npx decides to DOWNLOAD the CLI, which turns a container start into a
# multi-minute hang that ends in a restart loop. The images install it; if it is
# missing, say so and keep going instead of waiting.
if [ ! -x ./node_modules/.bin/prisma ]; then
  echo "[entrypoint] WARNING: node_modules/.bin/prisma missing — run npm ci (dev: npm run dev:stack:install)" >&2
fi

if [ -z "${SKIP_PRISMA_GENERATE:-}" ] && [ -x ./node_modules/.bin/prisma ]; then
  echo "[entrypoint] generating Prisma client"
  ./node_modules/.bin/prisma generate --schema prisma/schema.prisma >/dev/null
fi

if [ -z "${SKIP_MIGRATE:-}" ] && [ -x ./node_modules/.bin/prisma ]; then
  echo "[entrypoint] applying Prisma migrations"
  ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
  if [ "${SEED_ON_START:-true}" = "true" ]; then
    echo "[entrypoint] seeding (set SEED_ON_START=false to skip)"
    npm run db:seed || echo "[entrypoint] seed skipped (already applied or failed) — continuing"
  fi
fi

echo "[entrypoint] starting: $*"
# The API itself must not run as root. `su -c` takes ONE command string, so the
# argv is joined with spaces (Compose never sends shell metacharacters here).
if [ "$(id -u)" = "0" ]; then
  case "$1" in
    sh|bash|/bin/sh|/bin/bash) exec "$@" ;;
  esac
  exec su node -s /bin/sh -c "exec $*"
fi
exec "$@"
