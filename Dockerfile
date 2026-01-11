# Use official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# -------------------- Install dependencies (cached) --------------------

FROM base AS install

# Dev deps (used only for building / tooling)
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Production deps (runtime)
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# -------------------- Pre-release stage --------------------

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# -------------------- Final runtime image --------------------

FROM base AS release

# Create non-root user
RUN groupadd -r grokbot && useradd -r -g grokbot grokbot

WORKDIR /app

# Copy production dependencies
COPY --from=install --chown=grokbot:grokbot /temp/prod/node_modules node_modules

# Copy application code + migrations
COPY --from=prerelease --chown=grokbot:grokbot /app/src ./src
COPY --from=prerelease --chown=grokbot:grokbot /app/drizzle ./drizzle
COPY --from=prerelease --chown=grokbot:grokbot /app/package.json ./
COPY --from=prerelease --chown=grokbot:grokbot /app/tsconfig.json ./
COPY --from=prerelease --chown=grokbot:grokbot /app/drizzle.config.ts ./

# Switch to non-root user
USER grokbot

# Optional port (for healthchecks / future API)
EXPOSE 3000

# Health check (container-level)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun --version || exit 1

# Run migrations, then start bot
CMD ["sh", "-c", "bun run db:migrate && bun run src/index.ts"]