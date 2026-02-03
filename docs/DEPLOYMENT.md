# Deployment Guide

## Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   VPS-00    │     │   GPU-01    │     │   Docker    │       │
│  │  (Deploy)   │     │  (Gateway)  │     │  Desktop    │       │
│  ├─────────────┤     ├─────────────┤     ├─────────────┤       │
│  │ • Next.js   │     │ • API GW    │     │ • Infisical │       │
│  │ • API       │     │ • Ollama    │     │ • Redis     │       │
│  │ • Worker    │     │ • GPU tasks │     │ • Postgres  │       │
│  │ • Admin     │     │             │     │   (dev)     │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Hosts

| Host | Role | Services |
|------|------|----------|
| **VPS-00** | Application Server | Next.js, Fastify API, BullMQ Worker, Admin |
| **GPU-01** | Gateway + GPU | API Gateway, Ollama, GPU inference |
| **Docker Desktop** | Local Services | Infisical, Redis, PostgreSQL (dev) |

## Secrets Management - Infisical

Secrets are managed via Infisical running in Docker Desktop.

### Setup

```bash
# Start Infisical
docker compose -f infisical/docker-compose.yml up -d

# Login to Infisical CLI
infisical login

# Pull secrets to .env
infisical export --env=dev > .env
```

### Secret Categories

| Category | Examples |
|----------|----------|
| Database | DATABASE_URL, REDIS_URL |
| LLM Keys | GOOGLE_AI_API_KEY, DEEPSEEK_API_KEY |
| Auth | COOKIE_SECRET, JWT_SECRET |
| Services | OLLAMA_CLOUD_URL, OLLAMA_CLOUD_API_KEY |

## CI/CD Pipeline

### Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Branch  │───▶│   PR     │───▶│  Merge   │───▶│  Deploy  │
│  (dev)   │    │  (CI)    │    │  (main)  │    │ (VPS-00) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │
              ┌──────┴──────┐
              │ CI Checks:  │
              │ • Build     │
              │ • Typecheck │
              │ • Lint      │
              │ • Test      │
              └─────────────┘
```

### GitHub Actions

**CI** (`.github/workflows/ci.yml`):
- Runs on PR and push to main
- Steps: install → prisma generate → build → typecheck → lint

**Deploy** (`.github/workflows/deploy.yml`):
- Runs on push to main (after CI passes)
- Steps: build → push to registry → deploy to VPS-00

### Branch Protection Rules

**main branch:**
- Require PR before merging
- Require CI status checks to pass
- Require linear history
- No force pushes
- No deletions

## Deployment Process

### 1. Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Commit with conventional commits
git commit -m "feat: add new feature"

# Push branch
git push -u origin feature/my-feature
```

### 2. Pull Request

```bash
# Create PR
gh pr create --title "feat: add new feature" --body "Description..."

# Wait for CI to pass
gh pr checks

# Request review if needed
gh pr edit --add-reviewer username
```

### 3. Merge

```bash
# Merge when CI is green
gh pr merge --squash
```

### 4. Deploy

Automatic on merge to main:

1. GitHub Actions builds Docker images
2. Pushes to container registry
3. SSHs to VPS-00
4. Pulls new images
5. Restarts services via docker compose
6. Runs health checks

### 5. Monitor

```bash
# Check deployment status
ssh vps-00 'docker compose ps'

# View logs
ssh vps-00 'docker compose logs -f web'

# Check health endpoint
curl https://genai.hr/api/health
```

## Docker Compose - VPS-00

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  web:
    image: ghcr.io/wandeon/genai2-web:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production

  api:
    image: ghcr.io/wandeon/genai2-api:latest
    ports:
      - "4000:4000"
    env_file:
      - .env.production

  worker:
    image: ghcr.io/wandeon/genai2-worker:latest
    env_file:
      - .env.production

  admin:
    image: ghcr.io/wandeon/genai2-admin:latest
    ports:
      - "3001:3001"
```

## Rollback

```bash
# SSH to VPS-00
ssh vps-00

# List available versions
docker images ghcr.io/wandeon/genai2-web

# Rollback to previous version
docker compose down
docker compose -f docker-compose.prod.yml up -d --pull never

# Or specify exact version
docker compose pull ghcr.io/wandeon/genai2-web:v0.1.0
docker compose up -d
```

## Health Checks

| Endpoint | Expected |
|----------|----------|
| `GET /api/health` | `{"status":"ok"}` |
| `GET /api/trpc/health` | `{"result":{"data":"ok"}}` |

## Monitoring

- **Logs**: Docker logs, shipped to logging service
- **Metrics**: Prometheus metrics at `/metrics`
- **Alerts**: PagerDuty for critical failures
- **Cost**: Daily LLM cost dashboard
