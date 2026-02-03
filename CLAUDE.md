# CLAUDE.md - Claude Code Instructions

> This file contains instructions for Claude Code when working on GenAI Observatory.
> Read this file completely before making any changes.

## Project Overview

**Project:** GenAI Observatory ("World State AI Observatory")
**Type:** Multi-surface AI news intelligence platform
**Stack:** Next.js 15, TypeScript, PostgreSQL, Prisma, tRPC, Tailwind CSS v4, shadcn/ui
**Purpose:** Transform GenAI.hr from WordPress blog to real-time AI observatory

## Critical Rules

### 0. SECURITY IS RULE #1
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  SECURITY VIOLATIONS = IMMEDIATE STOP                       │
│                                                                 │
│  • NEVER expose services to 0.0.0.0 or public internet          │
│  • NEVER hardcode secrets, API keys, passwords                  │
│  • NEVER commit .env files                                      │
│  • NEVER disable firewalls or security features                 │
│  • NEVER skip input validation                                  │
│  • ALWAYS use environment variables for secrets                 │
│  • ALWAYS bind services to localhost or Tailscale IP            │
│  • ALWAYS validate and sanitize all inputs                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1. ALWAYS Read Before Writing
- Read DECISIONS.md before making architectural choices
- Read existing code in the module before adding new code
- Understand the context before implementing

### 2. NEVER Break These Rules
- **No code without tests** - Write tests for new functionality
- **No direct database queries** - Use Prisma through `@genai/db`
- **No hardcoded strings** - Use constants from `@genai/shared`
- **No any types** - Full TypeScript strict mode
- **No console.log in production** - Use proper logging
- **No secrets in code** - Use environment variables
- **No skipping validation** - Validate with Zod schemas

### 2b. ABSOLUTELY FORBIDDEN EXCUSES
```
These phrases are BANNED. If you catch yourself thinking them, STOP:

❌ "TS errors are preexisting"
   → YOU own ALL errors. Fix them or explain why they exist.

❌ "Skipping this test for now"
   → Tests reveal bugs. NEVER skip or loosen tests to make them pass.

❌ "Loosening this type to any"
   → Find the correct type. If truly impossible, document WHY.

❌ "This should work"
   → Verify it DOES work. Run the code.

❌ "I'll fix this later"
   → Fix it NOW or create a tracked issue.

❌ "It works on my end"
   → Not acceptable. Reproduce the full environment.
```

### 2c. TEST INTEGRITY
```
┌─────────────────────────────────────────────────────────────────┐
│  TESTS ARE SACRED                                               │
│                                                                 │
│  Tests exist to CATCH BUGS, not to pass CI.                     │
│                                                                 │
│  If a test fails:                                               │
│  1. The CODE is wrong, not the test (usually)                   │
│  2. Investigate WHY it fails                                    │
│  3. Fix the implementation                                      │
│  4. Only update test if requirements changed                    │
│                                                                 │
│  NEVER:                                                         │
│  • Delete tests to make CI pass                                 │
│  • Loosen assertions (expect.anything(), etc.)                  │
│  • Mock away the actual functionality being tested              │
│  • Change expected values to match wrong output                 │
│  • Use skip/xdescribe to hide failures                          │
└─────────────────────────────────────────────────────────────────┘
```

### 2d. FILE SIZE LIMITS
```
┌─────────────────────────────────────────────────────────────────┐
│  KEEP FILES SMALL AND FOCUSED                                   │
│                                                                 │
│  Prisma schema (schema.prisma): MAX 500 lines                   │
│  Component files: MAX 300 lines                                 │
│  Utility files: MAX 200 lines                                   │
│  Test files: MAX 500 lines                                      │
│                                                                 │
│  EXCEPTION: Orchestrator components                             │
│  Components that coordinate multiple subcomponents may exceed   │
│  300 lines if the complexity is inherent to their coordination  │
│  role. Document why in a comment at the top of the file.        │
│                                                                 │
│  If a file grows beyond limits:                                 │
│  1. STOP and refactor                                           │
│  2. Split into logical modules                                  │
│  3. Never let schema bloat!                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2e. DEFINITION OF DONE
```
┌─────────────────────────────────────────────────────────────────┐
│  A FEATURE IS NOT "DONE" UNTIL:                                 │
│                                                                 │
│  □ NO TODO comments in the feature code                         │
│  □ NO FIXME comments                                            │
│  □ NO placeholder values or hardcoded test data                 │
│  □ NO console.log statements                                    │
│  □ NO commented-out code                                        │
│  □ NO "temporary" solutions                                     │
│  □ ALL error states handled                                     │
│  □ ALL loading states handled                                   │
│  □ ALL empty states handled                                     │
│  □ Tests written and passing                                    │
│  □ Works on mobile (375px)                                      │
│  □ Works on desktop                                             │
│                                                                 │
│  When reporting completion, you MUST provide:                   │
│  1. List of files created/modified                              │
│  2. Tests added (with pass count)                               │
│  3. Result of: grep -r "TODO\|FIXME" in feature code            │
│  4. Result of: pnpm lint && pnpm typecheck && pnpm test         │
└─────────────────────────────────────────────────────────────────┘
```

**Banned phrases when reporting completion:**
```
❌ "Feature is done, just needs..."     → NOT DONE
❌ "Works, but I'll clean up..."        → NOT DONE
❌ "TODO: handle edge case"             → NOT DONE
❌ "Placeholder for now"                → NOT DONE
❌ "Will add tests later"               → NOT DONE
❌ "Quick fix, refactor later"          → NOT DONE
```

### 3. Git Workflow
```
1. Create feature branch: git checkout -b feat/feature-name
2. Make atomic commits with conventional format
3. Run tests before committing: pnpm test
4. Push and create PR
5. Wait for CI to pass
6. Merge only after CI green
```

**Commit Message Format:**
```
type(scope): description

feat(observatory): add time machine scrubber
fix(api): resolve session timeout issue
chore(deps): update dependencies
docs(api): add endpoint documentation
test(events): add integration tests for pipeline
refactor(ui): simplify lane component
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`, `perf`

### 4. Code Style

**Imports (in order):**
```typescript
// 1. React/Next
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. External packages
import { motion } from 'framer-motion';
import { z } from 'zod';

// 3. Internal packages
import { Button } from '@genai/ui';
import { HeadlinePayload } from '@genai/shared';

// 4. Local imports
import { EventCard } from '@/components';

// 5. Types
import type { Event } from '@genai/db';
```

**Component Structure:**
```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Constants
// 4. Component
// 5. Subcomponents (if small)
// 6. Export

interface EventCardProps {
  event: Event;
  onSelect?: () => void;
}

export function EventCard({ event, onSelect }: EventCardProps) {
  // Hooks first
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>...</div>
  );
}
```

### 5. Error Handling

**API Errors (tRPC):**
```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Validation failed',
  cause: zodError,
});
```

**Client-side:**
```typescript
try {
  await trpc.events.create.mutate(data);
  toast.success('Event created');
} catch (error) {
  toast.error(getErrorMessage(error));
}
```

### 6. Logging Rules

```typescript
// GOOD - Structured logging
import { logger } from '@genai/shared';
logger.info({ eventId, action: 'enriched' }, 'Event enriched');

// BAD - Console.log
console.log('Event enriched', eventId);

// FORBIDDEN - Logging sensitive data
logger.info({ apiKey, token }); // NEVER DO THIS
```

---

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

---

## Monorepo Structure

```
apps/
  web/      → Next.js frontend (port 3000)
  api/      → Fastify + tRPC (port 4000)
  worker/   → BullMQ processors
  admin/    → React Admin (port 3001)

packages/
  db/       → Prisma schema + client
  shared/   → Zod schemas, graph-safety, constants
  trpc/     → tRPC routers
  ui/       → shadcn components
  llm/      → GM service + LLM abstractions
```

### File Organization
```
When creating new files:
- Components → apps/web/src/components/[category]/
- API routes → packages/trpc/src/routers/
- Shared types → packages/shared/src/types/
- Validation schemas → packages/shared/src/schemas/
- Database operations → packages/db/src/
- UI primitives → packages/ui/src/components/
- Processors → apps/worker/src/processors/
```

---

## LLM Configuration

| Task Type | Provider | Model |
|-----------|----------|-------|
| Embeddings | Ollama Local | nomic-embed-text |
| Easy tasks | Google | gemini-3-flash-preview |
| Hard tasks | Google | gemini-3-pro-preview (DeepSeek fallback) |
| Cloud runs | Ollama Cloud | mixtral/llama3 |

---

## Infrastructure

All devices are on the same **Tailnet** (Tailscale network).

| Host | Tailscale IP | Public IP | Role |
|------|--------------|-----------|------|
| **GPU-01** (ArtemiPC) | 100.89.2.111 | - | Dev + Gateway, WSL, Ollama |
| **VPS-00** | 100.97.156.41 | 37.120.190.251 | Production server |
| **Docker Desktop** | localhost | - | Local dev services |

### Secrets Management - Infisical

Infisical credentials are in `.bashrc` on both GPU-01 and VPS-00:
```bash
INFISICAL_PROJECT_ID=...
INFISICAL_CLIENT_ID=...
INFISICAL_CLIENT_SECRET=...
INFISICAL_ENVIRONMENT=prod
```

Pull secrets: `infisical export --env=prod > .env`

---

## Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  DEPLOYMENT TARGETS - READ CAREFULLY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STAGING:  https://v2.genai.hr     ← Current development target             │
│  PRODUCTION: https://genai.hr      ← DO NOT DEPLOY until ready              │
│                                                                             │
│  Server: VPS-00 (37.120.190.251)                                            │
│  SSH: ssh deploy@100.97.156.41 (via Tailscale)                              │
│  App directory: /opt/genai2                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Architecture

```
GitHub Actions (on push to main)
        │
        ▼
┌───────────────────┐
│  Build & Push     │  → ghcr.io/wandeon/genai2-web:latest
│  Docker Images    │  → ghcr.io/wandeon/genai2-api:latest
│                   │  → ghcr.io/wandeon/genai2-worker:latest
└───────────────────┘
        │
        ▼ (SSH to VPS-00)
┌───────────────────┐
│  docker compose   │  /opt/genai2/docker-compose.yml
│  pull & up        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Caddy Reverse    │  /etc/caddy/Caddyfile
│  Proxy            │  v2.genai.hr → localhost:3000 (web)
│                   │              → localhost:4000 (api)
└───────────────────┘
```

### Services on VPS-00

| Container | Port | Purpose |
|-----------|------|---------|
| genai2-web-1 | 3000 | Next.js frontend |
| genai2-api-1 | 4000 | Fastify + tRPC API |
| genai2-worker-1 | - | BullMQ processors |
| genai2-postgres-1 | 5432 | PostgreSQL database |
| genai2-redis-1 | 6379 | Redis for queues |

### Manual Deployment

If GitHub Actions deployment fails or secrets aren't configured:

```bash
# SSH to VPS (via Tailscale)
ssh deploy@100.97.156.41

# Pull latest images and restart
cd /opt/genai2
docker compose pull
docker compose up -d --remove-orphans
docker compose ps  # Verify all healthy
```

### Caddy Configuration

The reverse proxy config for v2.genai.hr is in `/etc/caddy/Caddyfile`:
- `/api/*` and `/trpc/*` → localhost:4000 (API)
- Everything else → localhost:3000 (Web)

To reload Caddy after config changes:
```bash
sudo systemctl reload caddy
```

### Health Checks

```bash
# API health
curl https://v2.genai.hr/api/health

# Web app
curl -I https://v2.genai.hr

# Container status
ssh deploy@100.97.156.41 "docker compose -f /opt/genai2/docker-compose.yml ps"
```

---

## Development Workflow

```
branch → PR → CI green → merge → auto-deploy → monitor
```

1. Create feature branch from `main`
2. Make changes, commit with conventional commits
3. Push and create PR
4. CI must be green (build, typecheck, lint)
5. Merge to main
6. Auto-deploy to VPS-00
7. Monitor deployment

---

## Key Commands

```bash
pnpm install          # Install deps
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm typecheck        # Type check
pnpm lint             # Lint
pnpm test             # Run tests
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
```

---

## Croatian Language

- Root layout uses `lang="hr"`
- GM outputs include Croatian translations
- Date format: "29. siječnja 2026."
- Number format: "1.000" (not "1,000")
- Use preposition "u" (not "v")

---

## Key Files

- `packages/shared/src/schemas/artifacts.ts` - All artifact Zod schemas
- `packages/shared/src/graph-safety.ts` - Relationship validation rules
- `packages/llm/src/gm/contract.ts` - GM identity and voice constraints
- `apps/web/src/components/time-machine.tsx` - Flagship UX component
- `docs/ROADMAP.md` - Implementation phases and checkboxes
- `docs/DECISIONS.md` - Architectural decisions

---

## When Stuck

1. Check DECISIONS.md for architectural guidance
2. Look for similar implementations in codebase
3. Ask for clarification before guessing
4. Prefer simple solutions over clever ones

---

## Forbidden Actions

### Code Quality
- Modifying database schema without updating DECISIONS.md
- Adding new dependencies without justification
- Removing tests to make CI pass
- Committing directly to main
- Using `// @ts-ignore` or `any` types
- Skipping accessibility considerations
- Letting any file exceed size limits
- Using `expect.anything()` or loose matchers

### Security (CRITICAL)
- Hardcoding API keys, secrets, or passwords
- Binding services to 0.0.0.0 or public IPs
- Committing .env files
- Exposing internal services to public
- Disabling security features "temporarily"
- Logging sensitive data (passwords, tokens, PII)
- Using `dangerouslySetInnerHTML` without sanitization
- Trusting client-side data without server validation

### Infrastructure
- Running as root user
- Opening ports beyond what's needed
- Disabling firewalls
- Storing secrets in code or configs
- Creating logs without rotation
- Using weak passwords or default credentials

---

## Mandatory Planning Step

Before writing any code for a non-trivial change:

1. Produce a short PLAN including:
   - Goal
   - Files to change/create
   - Data models touched
   - New schemas needed
   - Tests to add

2. Wait for human confirmation.

NO implementation until plan is approved.

---

## Scaffold Preservation Rule

Never remove or simplify existing page scaffolds, layouts, or UX structures
unless explicitly instructed.

Placeholders may be added INSIDE existing structure,
but structure must remain intact.

If a scaffold seems excessive:
→ Propose a refactor plan
→ Do NOT delete.

---

## Zero Placeholder Policy

UI placeholders are forbidden.

Instead of:
- "Placeholder"
- "Coming soon"
- Dummy cards

Use:
- Skeleton loaders
- Empty states with explanation
- Or real minimal implementations.

Any literal placeholder text = NOT DONE.

---

## Database Change Protocol

Any Prisma schema change MUST include:

1. Migration file
2. Update to docs/DECISIONS.md
3. Rationale comment in schema
4. Backward compatibility note

PRs with schema changes missing these are invalid.

---

## LLM Cost Guardrail

Any feature that increases LLM usage must state:

- Expected cost per event
- Expected daily cost
- Mitigation strategy

If not provided → do not implement.
