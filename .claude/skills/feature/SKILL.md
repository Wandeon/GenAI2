---
name: feature
description: Structured feature implementation with environment checks, design-first approach, and task checkpointing. Use when implementing new features, adding functionality, or building complex components.
argument-hint: [feature-name]
user-invocable: true
---

# Feature Implementation

Implement feature: **$ARGUMENTS**

## Pre-Implementation Checklist

Before writing any code, verify the environment is ready:

```bash
# Environment check
pg_isready -h localhost -p 5432 || echo "WARNING: Database not running"
redis-cli ping || echo "WARNING: Redis not running"
[ -f .env ] || echo "WARNING: .env file missing"
[ -d node_modules ] || echo "WARNING: Run pnpm install"
```

If any service is missing, **stop and fix it first**. Do not work around infrastructure issues.

## Implementation Process

### Phase 1: Explore & Clarify

Ask these questions before proceeding:

- What problem does this feature solve?
- What are the acceptance criteria?
- Are there existing patterns to follow?
- What data models are involved?
- What are the edge cases?

### Phase 2: Create Task Plan

Break the feature into committable chunks:

```
Task 1: Data Layer
- Prisma schema changes
- Migrations
- Zod schemas

Task 2: API Layer
- tRPC routers
- Input validation
- Error handling

Task 3: UI Layer
- React components
- State management
- User feedback

Task 4: Integration
- Wire up components
- End-to-end tests
- Documentation
```

Use `TaskCreate` to track each task.

### Phase 3: Execute Tasks Sequentially

For EACH task:

1. **Start**: Mark task as in_progress
2. **Implement**: Write the code
3. **Verify**: Run `pnpm typecheck && pnpm test`
4. **Commit**: Create atomic commit
5. **Complete**: Mark task as completed

```
┌─────────────────────────────────────────────────────────────┐
│  NEVER skip to the next task until current task passes:    │
│  □ Typecheck passes                                        │
│  □ Tests pass (or new tests written)                       │
│  □ Changes committed                                       │
│  □ No TODO/FIXME in the code                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Final Verification

After all tasks complete:

```bash
# Full verification
pnpm typecheck
pnpm test
grep -r "TODO\|FIXME" [feature-files]
```

Report completion with:
- List of files created/modified
- Test count (e.g., "15 tests passing")
- Commit hashes

## Task Ordering

Always implement in this order:

1. **Data** (Prisma, migrations) - foundation
2. **Validation** (Zod schemas) - contracts
3. **API** (tRPC routers) - backend
4. **UI** (React components) - frontend
5. **Integration** (wiring, tests) - glue

## When Blocked

If you encounter a blocker:

1. Document what's blocking you
2. Create a follow-up task for the blocker
3. **Do NOT skip ahead** - blockers often cascade
4. Ask the user how to proceed

## Example Task Plan

For a "User Dashboard" feature:

```
Task 1: Add UserStats model to Prisma schema
Task 2: Create userStats Zod schemas
Task 3: Add userStats tRPC router with getStats procedure
Task 4: Create Dashboard page and StatsCard components
Task 5: Wire up tRPC queries and add loading states
Task 6: Add tests for router and components
```

Each task is independently verifiable and committable.
