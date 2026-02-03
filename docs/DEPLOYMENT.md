# Deployment Guide

## Infrastructure Overview

All devices are connected via **Tailscale** (same Tailnet).

```
┌─────────────────────────────────────────────────────────────────┐
│                     TAILNET INFRASTRUCTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐          ┌──────────────────┐            │
│  │     GPU-01       │          │     VPS-00       │            │
│  │   (ArtemiPC)     │          │  100.97.156.41   │            │
│  │  100.89.2.111    │          ├──────────────────┤            │
│  ├──────────────────┤          │ • Next.js        │            │
│  │ • WSL (dev)      │   ───▶   │ • Fastify API    │            │
│  │ • Ollama Local   │  deploy  │ • BullMQ Worker  │            │
│  │ • Docker Desktop │          │ • Admin Panel    │            │
│  │ • Redis (dev)    │          │ • PostgreSQL     │            │
│  │ • PostgreSQL(dev)│          │ • Redis          │            │
│  └──────────────────┘          └──────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Hosts

| Host | Tailscale IP | Role | Services |
|------|--------------|------|----------|
| **GPU-01** (ArtemiPC) | 100.89.2.111 | Dev + Gateway | WSL, Ollama Local, Docker Desktop |
| **VPS-00** | 100.97.156.41 | Application Server | Next.js, API, Worker, Admin, PostgreSQL, Redis |

## Secrets Management - Infisical

Secrets are managed via **Infisical Cloud**. Credentials are pre-configured in `.bashrc` on both GPU-01 and VPS-00.

### Environment Variables (in .bashrc)

```bash
export INFISICAL_PROJECT_ID="..."
export INFISICAL_CLIENT_ID="..."
export INFISICAL_CLIENT_SECRET="..."
export INFISICAL_ENVIRONMENT="prod"
```

### Setup

```bash
# Install Infisical CLI (if not installed)
curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash
sudo apt-get install infisical

# Pull secrets (credentials auto-loaded from .bashrc)
infisical export --env=prod > .env
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
ssh deploy@100.97.156.41 'cd /opt/genai2 && docker compose ps'

# View logs
ssh deploy@100.97.156.41 'cd /opt/genai2 && docker compose logs -f web'

# Check health endpoint (staging)
curl https://v2.genai.hr/api/health
```

### 6. Database Migrations (Post-Deployment)

After deploying schema changes, run migrations:

```bash
# SSH to VPS
ssh deploy@100.97.156.41

# Run migrations
cd /opt/genai2
docker compose exec api npx prisma migrate deploy

# Run seed (if needed)
docker compose exec api npx prisma db seed
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
