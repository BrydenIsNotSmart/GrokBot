# Use official Bun image
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock* /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Copy source code
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Build step (if needed in future, currently Bun runs TS directly)
# RUN bun build src/index.ts --outdir ./dist

# Final stage
FROM base AS release

# Create non-root user for security
RUN groupadd -r grokbot && useradd -r -g grokbot grokbot

WORKDIR /app

# Copy production dependencies
COPY --from=install --chown=grokbot:grokbot /temp/prod/node_modules node_modules

# Copy application code
COPY --from=prerelease --chown=grokbot:grokbot /app/src ./src
COPY --from=prerelease --chown=grokbot:grokbot /app/migrations ./migrations
COPY --from=prerelease --chown=grokbot:grokbot /app/package.json ./
COPY --from=prerelease --chown=grokbot:grokbot /app/tsconfig.json ./
COPY --from=prerelease --chown=grokbot:grokbot /app/drizzle.config.ts ./

# Switch to non-root user
USER grokbot

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun --version || exit 1

# Run the application
CMD ["bun", "run", "src/index.ts"]
