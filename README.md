# GenAI2

GenAI2 is the monorepo scaffold for the World State AI Observatory: a multi-surface system that ingests evidence, turns it into events, and ships curated artifacts for operators and readers. This repo focuses on getting the spine, tooling, and documentation correct so product development can start immediately.

## Project Structure

```
GenAI2/
├── apps/
│   ├── web/          # Next.js 16 (App Router) - Main frontend
│   ├── api/          # Fastify + tRPC - API server
│   ├── worker/       # BullMQ - Event processors
│   └── admin/        # React Admin - Admin dashboard
├── packages/
│   ├── db/           # Prisma schema + client
│   ├── shared/       # Zod schemas + utilities
│   ├── trpc/         # tRPC router + procedures
│   ├── ui/           # Shared shadcn components
│   └── llm/          # GM service + LLM abstractions
├── turbo.json        # Turborepo configuration
└── pnpm-workspace.yaml
```

## Requirements

- Node.js 20+ (see `.nvmrc` if added later)
- pnpm 9+ (`corepack enable`)

## Quickstart

```bash
# Install dependencies
pnpm install

# Copy root environment template
cp .env.example .env

# Copy per-app environment templates (edit as needed)
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/admin/.env.example apps/admin/.env

# Generate Prisma client
pnpm db:generate

# Run database migrations (dev only)
pnpm db:migrate

# Start development servers
pnpm dev
```

The first dev run should take under 5 minutes on a modern laptop.

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Start development servers
pnpm dev
```

## Development

```bash
# Run all apps in development mode
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests (placeholder for now)
pnpm test
```

## Environment setup

- Root: `.env` (shared services like database/redis)
- Per-app: `.env` or `.env.local` files inside each app (see `apps/*/.env.example`)
- Never commit real secrets; use `.env.example` for placeholders.

## Common commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Ports

| App | Port |
|-----|------|
| Web | 3000 |
| API | 4000 |
| Admin | 3001 |

## Tech Stack

- **Framework**: Next.js (App Router; target is 16)
- **API**: tRPC + Fastify
- **Database**: PostgreSQL + Prisma
- **Queue**: BullMQ + Redis
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: TanStack Query + tRPC

## Docs

- `docs/ARCHITECTURE.md` — architecture constitution & data flow
- `docs/CONTRIBUTING.md` — how to work in the monorepo
- `docs/DECISIONS.md` — key technical choices
- `docs/ENVIRONMENT.md` — environment variables & secrets strategy
