# syntax=docker/dockerfile:1
# DrillKe backend image: NestJS API (also runs the YouTube-sync worker).
# Build context MUST be the repo root (it needs prisma/, packages/shared, apps/api).
#
#   docker build -t drillke-api .
#   docker run -p 4000:4000 --env-file .env drillke-api

# ---- Builder ----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Prisma engines need openssl at generate/runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better layer caching). Copy only the manifests
# that npm needs to resolve the workspace graph.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=5

# Copy the sources needed to build the API (not the web app).
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate the Prisma client, then build shared -> api (order matters).
RUN npm run prisma:generate \
 && npm run build -w @drillke/shared \
 && npm run build -w @drillke/api

# Strip dev-only packages from node_modules so they don't land in the runtime image.
# `prisma` is a root devDependency but the Prisma CLI is the documented release
# step (`db:deploy`). With `prisma/` copied in below, `npx prisma` would otherwise
# try to download the CLI at runtime — which fails on read-only/offline hosts.
# Keeping it costs ~40 MB and makes migrations runnable from this image.
RUN npm prune --omit=dev && npm install --no-save --no-audit --no-fund prisma@^6.2.0

# Regenerate AFTER the prune: `npm prune` re-resolves the workspace graph and
# can leave a client generated against a different @prisma/client version. The
# entrypoint regenerates on boot too (the schema can change without an image
# rebuild), but baking it in keeps the image self-contained and fails the BUILD
# on a broken schema instead of at container start.
RUN npm run prisma:generate

# ---- Runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Debian ships the PostgreSQL server binaries in a versioned directory that is
# NOT on PATH (only the client wrappers are). The entrypoint needs initdb,
# pg_ctl and pg_isready. Set below once we know the major version.
# openssl: Prisma engines. wget: container healthcheck.
#
# PostgreSQL: the backend container OWNS its database (single-container backend
# + db, per the two-container layout), started by docker-entrypoint.sh.
#
# This deliberately uses Debian's own `postgresql` package (~15) instead of the
# third-party PGDG repo: apt.postgresql.org is frequently slow or unreachable
# (TLS handshakes time out), which made `docker build` fail for reasons that
# have nothing to do with this app. The entrypoint initialises whatever major
# version is installed and detects its bin dir, so 15 and 16 both work.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget curl postgresql \
 && rm -rf /var/lib/apt/lists/* \
 && npm cache clean --force \
 && pg_major="$(ls /usr/lib/postgresql | sort -n | tail -1)" \
 && echo "/usr/lib/postgresql/${pg_major}/bin" > /etc/drillke-pg-bin \
 && echo "PostgreSQL major version: ${pg_major}"

# pg_isready is part of postgresql-client, which the server package pulls in.
# Fail the build now rather than at container start if it is absent.
RUN PATH="$(cat /etc/drillke-pg-bin):$PATH" && pg_isready --version && initdb --version

# Bring over installed deps (incl. generated Prisma client + workspace symlink)
# and the compiled output. Source TS is intentionally left out of the image.
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/prisma ./prisma

# The `node` user must be able to write its cache on first run.
# The container starts as root only to initialise/start PostgreSQL; the
# entrypoint drops to `node` (via exec) for the API process itself.
RUN mkdir -p /home/node/.cache && chown -R node:node /home/node/.cache
# Entrypoint runs migrations + seed before the API process.
COPY infra/docker-entrypoint.sh /app/infra/docker-entrypoint.sh
RUN chmod +x /app/infra/docker-entrypoint.sh

# Starts as root so the entrypoint can chown the Postgres volume; the entrypoint
# drops to the unprivileged `node` user before starting the API process.
USER root

EXPOSE 4000
# Default process is the HTTP API. Start the worker by overriding the command:
#   node apps/api/dist/workers/youtube-sync.worker.js
#
# On boot the container runs `prisma migrate deploy` (then an idempotent seed
# unless SEED_ON_START=false) before starting the API, so a freshly cloned
# checkout has a working schema. See infra/docker-entrypoint.sh.
ENTRYPOINT ["/app/infra/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
