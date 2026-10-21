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

# ---- Runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Debian ships the PostgreSQL server binaries in a versioned directory that is
# NOT on PATH (only the client wrappers are). The entrypoint needs initdb,
# pg_ctl and pg_isready.
ENV PATH="/usr/lib/postgresql/16/bin:${PATH}"
# openssl: Prisma engines. wget: container healthcheck.
# PostgreSQL 16: the backend container OWNS its database (single-container
# backend + db, per the two-container layout), started by docker-entrypoint.sh.
# Debian bookworm only ships PostgreSQL 15, so add the official PGDG repo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-16 \
 && rm -rf /var/lib/apt/lists/* \
 && npm cache clean --force

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
