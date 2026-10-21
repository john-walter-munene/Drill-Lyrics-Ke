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

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[entrypoint] initialising PostgreSQL data directory at $PGDATA"
  as_postgres "initdb -D '$PGDATA' -U postgres --auth-local=trust --auth-host=scram-sha-256 >/dev/null"
fi

echo "[entrypoint] starting PostgreSQL"
as_postgres "pg_ctl -D '$PGDATA' -o '-c listen_addresses=localhost -p $PGPORT' -l /tmp/postgres.log -w start >/dev/null" \
  || { tail -n 50 /tmp/postgres.log 2>/dev/null; exit 1; }

echo "[entrypoint] ensuring role and database"
as_postgres "psql -U postgres -p $PGPORT -v ON_ERROR_STOP=1 -c \"DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$PG_USER') THEN CREATE ROLE \\\"$PG_USER\\\" LOGIN PASSWORD '$PG_PASS'; ELSE ALTER ROLE \\\"$PG_USER\\\" WITH LOGIN PASSWORD '$PG_PASS'; END IF; END \\\$\\\$;\" >/dev/null"
as_postgres "psql -U postgres -p $PGPORT -v ON_ERROR_STOP=1 -tAc \"SELECT 1 FROM pg_database WHERE datname = '$PG_DB'\" | grep -q 1 || createdb -U postgres -p $PGPORT -O '$PG_USER' '$PG_DB'"

# Migrations run as the app role against the app database.
export DATABASE_URL="${DATABASE_URL:-postgresql://$PG_USER:$PG_PASS@localhost:$PGPORT/$PG_DB?schema=public}"

if [ -z "${SKIP_MIGRATE:-}" ]; then
  echo "[entrypoint] applying Prisma migrations"
  npx prisma migrate deploy --schema prisma/schema.prisma
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
