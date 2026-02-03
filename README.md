# GenAI Observatory

World State AI Observatory - Real-time intelligence on AI developments.

## Architecture

See the plan document for full Architecture Constitution and data model.

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

## Primary Surfaces

| Surface | Route | Purpose |
|---------|-------|---------|
| Observatory | `/observatory` | Multi-lane glass cockpit with real-time events |
| Daily Run | `/daily` | Ritual briefing with GM commentary |
| Explore | `/explore/[slug]` | Entity dossier + relationship graph |
| Watchlists | `/watchlists` | User subscriptions with catch-up |
| Library | `/library` | Migrated articles + deep dives |

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
```

## Ports

| App | Port |
|-----|------|
| Web | 3000 |
| API | 4000 |
| Admin | 3001 |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **API**: tRPC + Fastify
- **Database**: PostgreSQL + Prisma
- **Queue**: BullMQ + Redis
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: TanStack Query + tRPC
