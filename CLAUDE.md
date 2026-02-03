# CLAUDE.md - Project Context for Claude Code

## Project Overview

GenAI Observatory ("World State AI Observatory") - transforms GenAI.hr from WordPress blog to a real-time AI news intelligence platform.

## Architecture Constitution

Every change must respect these 10 principles:

1. **EVIDENCE FIRST** - Every fact traces to EvidenceSnapshot. No orphan claims.
2. **APPEND-ONLY STATE MACHINE** - Events: RAW → ENRICHED → VERIFIED → PUBLISHED | QUARANTINED
3. **STRUCTURED OVER TEXT** - Artifacts store typed JSON payloads (Zod schemas), not text blobs
4. **QUERY-SHAPED APIs** - tRPC for type-safe queries. No REST-first thinking.
5. **SERVER-SIDE IDENTITY** - Anonymous sessions via HttpOnly cookie. No localStorage for important data.
6. **EVENT-DRIVEN PIPELINES** - New data → emit event → processors react. Cron only for heartbeats.
7. **SAFETY GATES ON RELATIONSHIPS** - High-risk claims require AUTHORITATIVE source OR 2+ sources
8. **GM AS VERSIONED SERVICE** - GM outputs are artifacts with version, model, prompt hash
9. **OBSERVABILITY BUILT-IN** - Every LLM call logs: model, tokens, cost, latency, run_id
10. **DOSSIER BEFORE GRAPH** - Entity exploration is text-first. Force-graph is optional.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **API**: tRPC + Fastify
- **Database**: PostgreSQL + Prisma
- **Queue**: BullMQ + Redis
- **Styling**: Tailwind CSS v4 + shadcn/ui

## Monorepo Structure

```
apps/
  web/      → Next.js frontend (port 3000)
  api/      → Fastify + tRPC (port 4000)
  worker/   → BullMQ processors
  admin/    → React Admin (port 3001)

packages/
  db/       → Prisma schema
  shared/   → Zod schemas, graph-safety
  trpc/     → tRPC routers
  ui/       → shadcn components
  llm/      → GM service
```

## LLM Configuration

| Task Type | Provider | Model |
|-----------|----------|-------|
| Embeddings | Ollama Local | nomic-embed-text |
| Easy LLM tasks | Google | gemini-3-flash-preview |
| Hard LLM tasks | Google | gemini-3-pro-preview (DeepSeek fallback) |
| Cloud LLM runs | Ollama Cloud | mixtral/llama3 |

## Development Workflow

1. Create feature branch from `main`
2. Make changes, commit with conventional commits
3. Push and create PR
4. CI must be green (build, typecheck, lint)
5. Merge to main
6. Auto-deploy to VPS-00
7. Monitor deployment

## Key Commands

```bash
pnpm install          # Install deps
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm typecheck        # Type check
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
```

## Infrastructure

| Service | Host | Purpose |
|---------|------|---------|
| App Deployment | VPS-00 | Main application servers |
| API Gateway | GPU-01 | Gateway + GPU workloads |
| Secrets | Infisical (Docker Desktop) | Secret management |
| Database | PostgreSQL | Primary data store |
| Cache/Queue | Redis | BullMQ + caching |

## Croatian Language

- Root layout uses `lang="hr"`
- GM outputs include Croatian translations
- Date format: "29. siječnja 2026."
- Number format: "1.000" (not "1,000")
- Use preposition "u" (not "v")

## Files to Know

- `packages/shared/src/schemas/artifacts.ts` - All artifact Zod schemas
- `packages/shared/src/graph-safety.ts` - Relationship validation rules
- `packages/llm/src/gm/contract.ts` - GM identity and voice constraints
- `apps/web/src/components/time-machine.tsx` - Flagship UX component
