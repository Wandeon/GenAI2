# Environment & Secrets

## Node version

- **Node.js 20+** is required (matches modern Next.js and TypeScript tooling).

## Secrets strategy

- Never commit real secrets.
- Use `.env.example` templates for every app.
- Real values live in `.env` / `.env.local` files or secret managers.

## Per-app environment variables

| App | File | Variable | Purpose | Default/Example |
| --- | --- | --- | --- | --- |
| Web | `apps/web/.env.local` | `NEXT_PUBLIC_API_URL` | API base URL | `http://localhost:4000` |
| Web | `apps/web/.env.local` | `NEXT_PUBLIC_APP_NAME` | UI label | `GenAI2` |
| API | `apps/api/.env` | `PORT` | HTTP port | `4000` |
| API | `apps/api/.env` | `HOST` | Bind host (container-internal only, Caddy handles public access) | `0.0.0.0` |
| API | `apps/api/.env` | `CORS_ORIGIN` | Allowed origin | `http://localhost:3000` |
| API | `apps/api/.env` | `COOKIE_SECRET` | Session cookie secret | `change-this-in-production` |
| API | `apps/api/.env` | `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| Worker | `apps/worker/.env` | `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| Worker | `apps/worker/.env` | `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| Worker | `apps/worker/.env` | `GOOGLE_AI_API_KEY` | Gemini API key | `""` |
| Worker | `apps/worker/.env` | `OPENAI_API_KEY` | OpenAI API key | `""` |
| Worker | `apps/worker/.env` | `ANTHROPIC_API_KEY` | Anthropic API key | `""` |
| Admin | `apps/admin/.env` | `VITE_API_URL` | API base URL | `http://localhost:4000` |
| Admin | `apps/admin/.env` | `VITE_APP_NAME` | UI label | `GenAI2 Admin` |

## Root environment

The root `.env` is optional and can be used for shared services (database, redis) during local dev. Copy from `.env.example` if needed.

## Secrets Management - Infisical

Production secrets are managed via **Infisical** running in Docker Desktop.

### Setup

```bash
# Start Infisical locally
docker compose -f infisical/docker-compose.yml up -d

# Login
infisical login

# Pull secrets for development
infisical export --env=dev > .env

# Pull secrets for production
infisical export --env=prod > .env.production
```

### Secret Categories

| Category | Variables |
|----------|-----------|
| Database | `DATABASE_URL`, `REDIS_URL` |
| LLM | `GOOGLE_AI_API_KEY`, `DEEPSEEK_API_KEY` |
| Ollama | `OLLAMA_LOCAL_URL`, `OLLAMA_CLOUD_URL`, `OLLAMA_CLOUD_API_KEY` |
| Auth | `COOKIE_SECRET`, `JWT_SECRET` |

## Infrastructure Hosts

| Host | Role | Services |
|------|------|----------|
| **VPS-00** | App Server | Next.js, API, Worker, Admin |
| **GPU-01** | Gateway | API Gateway, Ollama Local, GPU tasks |
| **Docker Desktop** | Local Dev | Infisical, Redis, PostgreSQL |

## CI/CD Secrets (GitHub)

These secrets must be configured in GitHub repository settings:

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | VPS-00 hostname/IP |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key for deployment |
| `HEALTH_CHECK_URL` | Production URL for health checks |
