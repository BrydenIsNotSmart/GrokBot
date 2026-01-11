# Docker Setup Guide

This guide will help you run GrokBot in a Docker container.

## Prerequisites

- Docker and Docker Compose installed
- Discord Bot Token and Client ID

## Quick Start

### 1. Clone and Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use your preferred editor
```

### 2. Run with Docker Compose (Recommended)

This will start both the bot and PostgreSQL database:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f grokbot

# Stop containers
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

### 3. Run with Docker Only

If you already have a PostgreSQL database:

```bash
# Build the image
docker build -t grokbot .

# Run the container
docker run -d \
  --name grokbot \
  --restart unless-stopped \
  --env-file .env \
  grokbot

# View logs
docker logs -f grokbot

# Stop container
docker stop grokbot
docker rm grokbot
```

## Environment Variables

Required environment variables:

- `BOT_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application client ID
- `DATABASE_URL` - PostgreSQL connection string
- `XAI_API_KEY` - Your xAI API key for Grok models

Optional:

- `GUILD_ID` - For guild-specific commands (leave empty for global)

## Database Migrations

If you need to run database migrations:

```bash
# With docker-compose
docker-compose exec grokbot bun run drizzle-kit migrate

# With docker
docker exec -it grokbot bun run drizzle-kit migrate
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs grokbot
```

### Database connection issues

Ensure the `DATABASE_URL` in your `.env` matches the docker-compose service name:
- Use `postgres` as hostname when using docker-compose
- Use your actual hostname/IP when using external database

### Permission issues

The container runs as a non-root user (`grokbot`) for security. If you encounter permission issues, check file ownership.

## Production Deployment

For production:

1. Use a managed PostgreSQL database (AWS RDS, DigitalOcean, etc.)
2. Set up proper secrets management
3. Use Docker secrets or environment variable injection
4. Set up monitoring and logging
5. Configure resource limits in docker-compose.yml

Example resource limits:
```yaml
services:
  grokbot:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```
