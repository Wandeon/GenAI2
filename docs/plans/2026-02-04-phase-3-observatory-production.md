# Phase 3: Observatory Production Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock feed data with real database queries, add real-time updates, GM transparency panel, and quarantine lane to make Observatory production-ready.

**Architecture:** The Observatory currently fetches events from external feeds (HN, GitHub, arXiv APIs). Phase 3 switches to querying the Prisma Event model populated by Phase 2 pipeline. SSE provides real-time signals when new events arrive. Lane configuration and session state persist via AnonSession.

**Tech Stack:** tRPC, Prisma, Fastify SSE, React Query, react-virtual (virtualization), Zod

---

## Phase 3 Overview

| Sprint | Focus | Tasks |
|--------|-------|-------|
| 3.1 | Database-Backed Events | Replace feed services with Prisma queries |
| 3.2 | Event Details & Artifacts | Add artifact data to event queries |
| 3.3 | Real-Time Updates | SSE endpoint for new event signals |
| 3.4 | Time Machine Real Data | Database-backed time filtering |
| 3.5 | Lane Configuration | Persist and restore lane preferences |
| 3.6 | GM Transparency Panel | Show LLM cost, model, latency |
| 3.7 | Quarantine Lane | Admin view for quarantined events |
| 3.8 | Virtualization | Efficient rendering for large lists |

---

## Prerequisites

Before starting, ensure:
1. Phase 2 migrations are applied and seeded
2. Database has events from pipeline (or seed test data)
3. All 192 tests pass: `pnpm test`

---

## Sprint 3.1: Database-Backed Events

**Goal:** Replace mock feed services with Prisma queries on the Event model.

### Task 1: Add Prisma client to tRPC context

**Files:**
- Modify: `packages/trpc/src/trpc.ts`

**Step 1: Update Context interface and creation**

```typescript
// packages/trpc/src/trpc.ts
import { initTRPC } from "@trpc/server";
import { prisma } from "@genai/db";
import type { PrismaClient } from "@prisma/client";

export interface Context {
  db: PrismaClient;
}

export function createContext(): Context {
  return {
    db: prisma,
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: PASS (or warnings about unused db in existing routers)

**Step 3: Commit**

```bash
git add packages/trpc/src/trpc.ts
git commit -m "feat(trpc): add Prisma client to tRPC context"
```

---

### Task 2: Create database event types

**Files:**
- Modify: `packages/shared/src/types/feeds.ts`

**Step 1: Extend NormalizedEvent type for database events**

```typescript
// packages/shared/src/types/feeds.ts
import type { EventStatus, ImpactLevel, SourceType, ArtifactType } from "@prisma/client";

export type NormalizedEvent = {
  id: string;
  sourceType: SourceType;
  externalId: string;
  url: string;
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics: string[];
  // New Phase 3 fields
  status?: EventStatus;
  headline?: string;
  summary?: string;
  gmTake?: string;
};

// Database event with full artifacts
export type EventWithArtifacts = NormalizedEvent & {
  artifacts: Array<{
    type: ArtifactType;
    payload: unknown;
    modelUsed: string;
    version: number;
  }>;
  llmRuns: Array<{
    model: string;
    costCents: number;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
  }>;
};

// Re-export for backward compatibility
export type { EventStatus, ImpactLevel, SourceType, ArtifactType };
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/shared/src/types/feeds.ts
git commit -m "feat(shared): extend NormalizedEvent with database fields"
```

---

### Task 3: Create events router tests

**Files:**
- Create: `packages/trpc/src/routers/__tests__/events.test.ts`

**Step 1: Write tests for database-backed events router**

```typescript
// packages/trpc/src/routers/__tests__/events.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventsRouter } from "../events";
import { createContext } from "../../trpc";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@genai/db";

describe("events router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns published events from database", async () => {
      const mockEvents = [
        {
          id: "evt_1",
          title: "Test Event",
          occurredAt: new Date("2026-02-01"),
          status: "PUBLISHED",
          impactLevel: "HIGH",
          sourceType: "HN",
          sourceId: "hn_123",
          evidence: [{ id: "ev_1" }],
          topics: [{ topic: { slug: "llm", name: "LLM" } }],
          artifacts: [],
        },
      ];

      vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as any);
      vi.mocked(prisma.event.count).mockResolvedValue(1);

      const ctx = createContext();
      const caller = eventsRouter.createCaller(ctx);

      const result = await caller.list({ limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("evt_1");
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PUBLISHED",
          }),
        })
      );
    });

    it("filters by sourceType", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);
      vi.mocked(prisma.event.count).mockResolvedValue(0);

      const ctx = createContext();
      const caller = eventsRouter.createCaller(ctx);

      await caller.list({ limit: 10, sourceType: "GITHUB" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceType: "GITHUB",
          }),
        })
      );
    });

    it("filters by time (beforeTime)", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);
      vi.mocked(prisma.event.count).mockResolvedValue(0);

      const ctx = createContext();
      const caller = eventsRouter.createCaller(ctx);
      const beforeTime = new Date("2026-02-01");

      await caller.list({ limit: 10, beforeTime });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            occurredAt: { lte: beforeTime },
          }),
        })
      );
    });

    it("supports cursor-based pagination", async () => {
      vi.mocked(prisma.event.findMany).mockResolvedValue([]);
      vi.mocked(prisma.event.count).mockResolvedValue(0);

      const ctx = createContext();
      const caller = eventsRouter.createCaller(ctx);

      await caller.list({ limit: 10, cursor: "evt_123" });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "evt_123" },
          skip: 1,
        })
      );
    });
  });

  describe("byId", () => {
    it("returns event with artifacts", async () => {
      const mockEvent = {
        id: "evt_1",
        title: "Test",
        artifacts: [
          { artifactType: "HEADLINE", payload: { en: "Headline" } },
        ],
      };

      vi.mocked(prisma.event.findUnique).mockResolvedValue(mockEvent as any);

      const ctx = createContext();
      const caller = eventsRouter.createCaller(ctx);

      const result = await caller.byId("evt_1");

      expect(result?.id).toBe("evt_1");
      expect(prisma.event.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_1" },
          include: expect.objectContaining({
            artifacts: true,
          }),
        })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/trpc && pnpm test src/routers/__tests__/events.test.ts
```

Expected: FAIL (current router uses feed services, not Prisma)

---

### Task 4: Rewrite events router to use Prisma

**Files:**
- Modify: `packages/trpc/src/routers/events.ts`

**Step 1: Replace feed services with Prisma queries**

```typescript
// packages/trpc/src/routers/events.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import type { NormalizedEvent } from "@genai/shared";
import { TRPCError } from "@trpc/server";

const SourceType = z.enum(["HN", "GITHUB", "ARXIV", "NEWSAPI", "REDDIT", "LOBSTERS", "PRODUCTHUNT", "DEVTO", "YOUTUBE", "LEADERBOARD", "HUGGINGFACE"]);
const ImpactLevel = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);
const EventStatus = z.enum(["RAW", "ENRICHED", "VERIFIED", "PUBLISHED", "QUARANTINED", "BLOCKED"]);

// Transform database event to NormalizedEvent
function toNormalizedEvent(event: any): NormalizedEvent {
  // Extract headline from artifacts
  const headlineArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "HEADLINE"
  );
  const summaryArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "SUMMARY"
  );
  const gmTakeArtifact = event.artifacts?.find(
    (a: any) => a.artifactType === "GM_TAKE"
  );

  return {
    id: event.id,
    sourceType: event.sourceType,
    externalId: event.sourceId,
    url: event.evidence?.[0]?.snapshot?.source?.rawUrl || "",
    title: event.title,
    titleHr: event.titleHr || undefined,
    occurredAt: event.occurredAt,
    impactLevel: event.impactLevel,
    sourceCount: event.evidence?.length || 1,
    topics: event.topics?.map((t: any) => t.topic?.slug || t.topicId) || [],
    status: event.status,
    headline: headlineArtifact?.payload?.en,
    summary: summaryArtifact?.payload?.en,
    gmTake: gmTakeArtifact?.payload?.take,
  };
}

export const eventsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        sourceType: SourceType.optional(),
        impactLevel: ImpactLevel.optional(),
        beforeTime: z.date().optional(),
        status: EventStatus.optional(),
        topicSlug: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        // Default: only show PUBLISHED events
        status: input.status || "PUBLISHED",
      };

      if (input.sourceType) {
        where.sourceType = input.sourceType;
      }

      if (input.impactLevel) {
        where.impactLevel = input.impactLevel;
      }

      if (input.beforeTime) {
        where.occurredAt = { lte: input.beforeTime };
      }

      if (input.topicSlug) {
        where.topics = {
          some: {
            topic: { slug: input.topicSlug },
          },
        };
      }

      const events = await ctx.db.event.findMany({
        where,
        include: {
          evidence: {
            take: 1,
            include: {
              snapshot: {
                include: { source: true },
              },
            },
          },
          topics: {
            include: { topic: true },
          },
          artifacts: {
            where: {
              artifactType: { in: ["HEADLINE", "SUMMARY", "GM_TAKE"] },
            },
          },
        },
        orderBy: { occurredAt: "desc" },
        take: input.limit + 1, // Fetch one extra to determine if there's more
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      let nextCursor: string | null = null;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id || null;
      }

      return {
        items: events.map(toNormalizedEvent),
        nextCursor,
      };
    }),

  byId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.event.findUnique({
        where: { id: input },
        include: {
          evidence: {
            include: {
              snapshot: {
                include: { source: true },
              },
            },
          },
          topics: {
            include: { topic: true },
          },
          artifacts: true,
          mentions: {
            include: { entity: true },
          },
          statusHistory: {
            orderBy: { changedAt: "desc" },
            take: 5,
          },
        },
      });

      if (!event) {
        return null;
      }

      return {
        ...toNormalizedEvent(event),
        artifacts: event.artifacts.map((a) => ({
          type: a.artifactType,
          payload: a.payload,
          modelUsed: a.modelUsed,
          version: a.version,
        })),
        entities: event.mentions.map((m) => ({
          id: m.entity.id,
          name: m.entity.name,
          type: m.entity.type,
          role: m.role,
        })),
        statusHistory: event.statusHistory,
        evidence: event.evidence.map((e) => ({
          id: e.id,
          url: e.snapshot.source.rawUrl,
          domain: e.snapshot.source.domain,
          trustTier: e.snapshot.source.trustTier,
          retrievedAt: e.snapshot.retrievedAt,
        })),
      };
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Use PostgreSQL full-text search
      const events = await ctx.db.$queryRaw<any[]>`
        SELECT e.id, e.title, e."titleHr", e."occurredAt", e."impactLevel", e."sourceType", e."sourceId", e.status
        FROM events e
        WHERE e.status = 'PUBLISHED'
          AND e.search_vector @@ plainto_tsquery('english', ${input.query})
        ORDER BY ts_rank(e.search_vector, plainto_tsquery('english', ${input.query})) DESC
        LIMIT ${input.limit}
      `;

      return events.map((e) => ({
        id: e.id,
        title: e.title,
        titleHr: e.titleHr,
        occurredAt: e.occurredAt,
        impactLevel: e.impactLevel,
        sourceType: e.sourceType,
        externalId: e.sourceId,
        url: "",
        sourceCount: 1,
        topics: [],
        status: e.status,
      }));
    }),

  // New: count events for catch-up calculation
  countSince: publicProcedure
    .input(
      z.object({
        since: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: input.since },
        },
      });

      return { count };
    }),
});
```

**Step 2: Run tests**

```bash
cd packages/trpc && pnpm test src/routers/__tests__/events.test.ts
```

Expected: PASS

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add packages/trpc/src/routers/events.ts packages/trpc/src/routers/__tests__/events.test.ts
git commit -m "feat(trpc): rewrite events router with Prisma queries"
```

---

### Task 5: Update API to pass context correctly

**Files:**
- Modify: `apps/api/src/index.ts`

**Step 1: Update context creation**

```typescript
// apps/api/src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createContext, type Context } from "@genai/trpc";

const server = Fastify({
  logger: true,
});

// Register plugins
await server.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});

await server.register(cookie, {
  secret: process.env.COOKIE_SECRET || "development-secret-change-in-production",
});

// Register tRPC
await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

// Health check (both paths for flexibility)
server.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

server.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Start server
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  await server.listen({ port, host });
  console.log(`API server running at http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
```

**Step 2: Export createContext from trpc package**

```typescript
// packages/trpc/src/index.ts - add export
export { createContext } from "./trpc";
```

**Step 3: Run build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add apps/api/src/index.ts packages/trpc/src/index.ts
git commit -m "feat(api): connect tRPC context with Prisma"
```

---

## Sprint 3.2: Event Details & Artifacts

**Goal:** Extend event queries to include full artifact data for GM Transparency.

### Task 6: Create LLM runs router for observability

**Files:**
- Create: `packages/trpc/src/routers/llm-runs.ts`

**Step 1: Implement LLM runs router**

```typescript
// packages/trpc/src/routers/llm-runs.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const llmRunsRouter = router({
  byEventId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const runs = await ctx.db.lLMRun.findMany({
        where: { eventId: input },
        orderBy: { createdAt: "asc" },
      });

      return runs.map((run) => ({
        id: run.id,
        provider: run.provider,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        costCents: run.costCents,
        latencyMs: run.latencyMs,
        processorName: run.processorName,
        createdAt: run.createdAt,
      }));
    }),

  // Daily cost summary for dashboard
  dailyCost: publicProcedure
    .input(
      z.object({
        days: z.number().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const runs = await ctx.db.lLMRun.groupBy({
        by: ["processorName"],
        where: {
          createdAt: { gte: since },
        },
        _sum: {
          costCents: true,
          totalTokens: true,
        },
        _count: true,
      });

      const totalCostCents = runs.reduce(
        (sum, r) => sum + (r._sum.costCents || 0),
        0
      );

      return {
        totalCostCents,
        totalCostDollars: totalCostCents / 100,
        byProcessor: runs.map((r) => ({
          processor: r.processorName,
          costCents: r._sum.costCents || 0,
          tokens: r._sum.totalTokens || 0,
          calls: r._count,
        })),
      };
    }),
});
```

**Step 2: Register in root router**

```typescript
// packages/trpc/src/root.ts
import { llmRunsRouter } from "./routers/llm-runs";

export const appRouter = router({
  events: eventsRouter,
  entities: entitiesRouter,
  topics: topicsRouter,
  search: searchRouter,
  llmRuns: llmRunsRouter,
});
```

**Step 3: Commit**

```bash
git add packages/trpc/src/routers/llm-runs.ts packages/trpc/src/root.ts
git commit -m "feat(trpc): add LLM runs router for cost observability"
```

---

## Sprint 3.3: Real-Time Updates (SSE)

**Goal:** Add SSE endpoint to signal when new events are created.

### Task 7: Add SSE endpoint to Fastify

**Files:**
- Create: `apps/api/src/sse/events.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create SSE handler**

```typescript
// apps/api/src/sse/events.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@genai/db";

// Store connected clients
const clients = new Set<FastifyReply>();

// Broadcast to all connected clients
export function broadcastNewEvent(eventId: string) {
  const message = JSON.stringify({ type: "new_event", eventId });
  for (const client of clients) {
    client.raw.write(`data: ${message}\n\n`);
  }
}

export async function registerSSE(fastify: FastifyInstance) {
  fastify.get("/api/sse/events", async (request: FastifyRequest, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    });

    // Send initial connection message
    reply.raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Add client to set
    clients.add(reply);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 30000);

    // Clean up on disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(reply);
    });

    // Keep connection open (don't call reply.send())
    return reply;
  });

  // Endpoint to trigger broadcast (called by worker)
  fastify.post("/api/sse/broadcast", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { eventId?: string };
    if (body.eventId) {
      broadcastNewEvent(body.eventId);
    }
    return { ok: true, clients: clients.size };
  });
}
```

**Step 2: Register SSE in API**

```typescript
// apps/api/src/index.ts - add after cookie registration
import { registerSSE } from "./sse/events";

// ... existing code ...

// Register SSE endpoints
await registerSSE(server);

// ... rest of code ...
```

**Step 3: Commit**

```bash
git add apps/api/src/sse/events.ts apps/api/src/index.ts
git commit -m "feat(api): add SSE endpoint for real-time event updates"
```

---

### Task 8: Create useEventStream hook for web

**Files:**
- Create: `apps/web/src/hooks/use-event-stream.ts`

**Step 1: Implement SSE hook**

```typescript
// apps/web/src/hooks/use-event-stream.ts
"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface EventStreamOptions {
  onNewEvent?: (eventId: string) => void;
  enabled?: boolean;
}

export function useEventStream(options: EventStreamOptions = {}) {
  const { onNewEvent, enabled = true } = options;
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const url = `${apiUrl}/api/sse/events`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_event" && data.eventId) {
          // Invalidate events query to refetch
          queryClient.invalidateQueries({ queryKey: ["events"] });

          // Call callback if provided
          onNewEvent?.(data.eventId);
        }
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    eventSource.onerror = () => {
      // Reconnect after 5 seconds
      eventSource.close();
      setTimeout(connect, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, onNewEvent, queryClient]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return {
    isConnected: !!eventSourceRef.current,
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-event-stream.ts
git commit -m "feat(web): add useEventStream hook for real-time updates"
```

---

## Sprint 3.4: Time Machine Real Data

**Goal:** Wire Time Machine to use database queries instead of client-side filtering.

### Task 9: Update Time Machine context to use beforeTime filter

**Files:**
- Modify: `apps/web/src/context/time-context.tsx`
- Modify: `apps/web/src/app/observatory/page.tsx`

**Step 1: Update TimeContext to expose beforeTime**

```typescript
// apps/web/src/context/time-context.tsx
"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";

interface TimeContextValue {
  scrubberValue: number; // 0-100
  targetTimestamp: Date | null;
  beforeTime: Date | null; // For query filtering
  catchUpCount: number;
  setScrubberValue: (value: number) => void;
  setCatchUpCount: (count: number) => void;
  jumpToNow: () => void;
  isLive: boolean;
}

const TimeContext = createContext<TimeContextValue | null>(null);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const [scrubberValue, setScrubberValue] = useState(100); // 100 = now
  const [catchUpCount, setCatchUpCount] = useState(0);

  const targetTimestamp = useMemo(() => {
    if (scrubberValue >= 100) return null;
    const now = Date.now();
    const offset = ((100 - scrubberValue) / 100) * SEVEN_DAYS_MS;
    return new Date(now - offset);
  }, [scrubberValue]);

  // beforeTime for queries - null means "now" (no filter)
  const beforeTime = targetTimestamp;
  const isLive = scrubberValue >= 100;

  const jumpToNow = useCallback(() => {
    setScrubberValue(100);
  }, []);

  return (
    <TimeContext.Provider
      value={{
        scrubberValue,
        targetTimestamp,
        beforeTime,
        catchUpCount,
        setScrubberValue,
        setCatchUpCount,
        jumpToNow,
        isLive,
      }}
    >
      {children}
    </TimeContext.Provider>
  );
}

export function useTime() {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within TimeProvider");
  }
  return context;
}
```

**Step 2: Update Observatory to pass beforeTime to query**

```typescript
// In apps/web/src/app/observatory/page.tsx
// Find the tRPC query and add beforeTime filter

const { beforeTime } = useTime();

const { data: hnEvents } = trpc.events.list.useQuery({
  limit: 50,
  sourceType: "HN",
  beforeTime: beforeTime || undefined,
});
```

**Step 3: Commit**

```bash
git add apps/web/src/context/time-context.tsx apps/web/src/app/observatory/page.tsx
git commit -m "feat(web): wire Time Machine to database queries"
```

---

## Sprint 3.5: Lane Configuration

**Goal:** Persist and restore user's lane preferences.

### Task 10: Create lane configuration context

**Files:**
- Create: `apps/web/src/context/lane-config-context.tsx`

**Step 1: Implement lane config with localStorage persistence**

```typescript
// apps/web/src/context/lane-config-context.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type LaneId = "hn" | "github" | "arxiv" | "all" | "quarantine";

interface LaneConfig {
  id: LaneId;
  enabled: boolean;
  order: number;
}

interface LaneConfigContextValue {
  lanes: LaneConfig[];
  activeLanes: LaneId[];
  toggleLane: (id: LaneId) => void;
  reorderLanes: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
}

const LaneConfigContext = createContext<LaneConfigContextValue | null>(null);

const DEFAULT_LANES: LaneConfig[] = [
  { id: "hn", enabled: true, order: 0 },
  { id: "github", enabled: true, order: 1 },
  { id: "arxiv", enabled: true, order: 2 },
  { id: "all", enabled: false, order: 3 },
  { id: "quarantine", enabled: false, order: 4 },
];

const STORAGE_KEY = "genai-lane-config";

export function LaneConfigProvider({ children }: { children: React.ReactNode }) {
  const [lanes, setLanes] = useState<LaneConfig[]>(DEFAULT_LANES);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLanes(parsed);
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes));
  }, [lanes]);

  const toggleLane = useCallback((id: LaneId) => {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id === id ? { ...lane, enabled: !lane.enabled } : lane
      )
    );
  }, []);

  const reorderLanes = useCallback((fromIndex: number, toIndex: number) => {
    setLanes((prev) => {
      const newLanes = [...prev];
      const [moved] = newLanes.splice(fromIndex, 1);
      newLanes.splice(toIndex, 0, moved);
      return newLanes.map((lane, i) => ({ ...lane, order: i }));
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setLanes(DEFAULT_LANES);
  }, []);

  const activeLanes = lanes
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order)
    .map((l) => l.id);

  return (
    <LaneConfigContext.Provider
      value={{
        lanes,
        activeLanes,
        toggleLane,
        reorderLanes,
        resetToDefault,
      }}
    >
      {children}
    </LaneConfigContext.Provider>
  );
}

export function useLaneConfig() {
  const context = useContext(LaneConfigContext);
  if (!context) {
    throw new Error("useLaneConfig must be used within LaneConfigProvider");
  }
  return context;
}
```

**Step 2: Update Observatory layout to use LaneConfigProvider**

**Step 3: Commit**

```bash
git add apps/web/src/context/lane-config-context.tsx
git commit -m "feat(web): add lane configuration with persistence"
```

---

## Sprint 3.6: GM Transparency Panel

**Goal:** Show LLM cost, model, latency for selected events.

### Task 11: Create TransparencyPanel component

**Files:**
- Create: `apps/web/src/components/transparency-panel.tsx`

**Step 1: Implement transparency panel**

```typescript
// apps/web/src/components/transparency-panel.tsx
"use client";

import { trpc } from "@/lib/trpc";

interface TransparencyPanelProps {
  eventId: string;
}

export function TransparencyPanel({ eventId }: TransparencyPanelProps) {
  const { data: event } = trpc.events.byId.useQuery(eventId);
  const { data: llmRuns } = trpc.llmRuns.byEventId.useQuery(eventId);

  if (!event) return null;

  const totalCost = llmRuns?.reduce((sum, run) => sum + run.costCents, 0) || 0;
  const totalLatency = llmRuns?.reduce((sum, run) => sum + run.latencyMs, 0) || 0;

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-medium mb-3">GM Transparency</h4>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        <div className="bg-muted rounded p-2">
          <div className="text-muted-foreground">Cost</div>
          <div className="font-mono">${(totalCost / 100).toFixed(4)}</div>
        </div>
        <div className="bg-muted rounded p-2">
          <div className="text-muted-foreground">Latency</div>
          <div className="font-mono">{totalLatency}ms</div>
        </div>
        <div className="bg-muted rounded p-2">
          <div className="text-muted-foreground">Sources</div>
          <div className="font-mono">{event.evidence?.length || 0}</div>
        </div>
      </div>

      {/* Artifacts */}
      {event.artifacts && event.artifacts.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Artifacts</h5>
          {event.artifacts.map((artifact, i) => (
            <div key={i} className="text-xs bg-muted/50 rounded p-2">
              <div className="flex justify-between">
                <span className="font-medium">{artifact.type}</span>
                <span className="text-muted-foreground">v{artifact.version}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                Model: {artifact.modelUsed}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LLM Runs */}
      {llmRuns && llmRuns.length > 0 && (
        <div className="mt-3 space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">LLM Calls</h5>
          {llmRuns.map((run) => (
            <div key={run.id} className="text-xs bg-muted/50 rounded p-2">
              <div className="flex justify-between">
                <span>{run.processorName}</span>
                <span className="font-mono">${(run.costCents / 100).toFixed(4)}</span>
              </div>
              <div className="text-muted-foreground">
                {run.model} • {run.inputTokens}→{run.outputTokens} tokens • {run.latencyMs}ms
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidence */}
      {event.evidence && event.evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Evidence</h5>
          {event.evidence.map((e) => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-blue-500 hover:underline truncate"
            >
              {e.domain} ({e.trustTier})
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add to ContextPanel**

**Step 3: Commit**

```bash
git add apps/web/src/components/transparency-panel.tsx
git commit -m "feat(web): add GM Transparency panel"
```

---

## Sprint 3.7: Quarantine Lane

**Goal:** Add admin view for quarantined events.

### Task 12: Create QuarantineLane component

**Files:**
- Create: `apps/web/src/components/quarantine-lane.tsx`

**Step 1: Implement quarantine lane**

```typescript
// apps/web/src/components/quarantine-lane.tsx
"use client";

import { trpc } from "@/lib/trpc";
import { Lane } from "./lane";
import { EventCard } from "./event-card";
import { AlertTriangle } from "lucide-react";

export function QuarantineLane() {
  const { data, isLoading } = trpc.events.list.useQuery({
    limit: 50,
    status: "QUARANTINED",
  });

  const events = data?.items || [];

  return (
    <Lane
      title="Quarantine"
      icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
      count={events.length}
      isLoading={isLoading}
    >
      {events.map((event) => (
        <div key={event.id} className="relative">
          <div className="absolute -left-1 top-2 w-1 h-8 bg-yellow-500 rounded-r" />
          <EventCard event={event} />
        </div>
      ))}
      {events.length === 0 && !isLoading && (
        <div className="text-center text-muted-foreground py-8">
          No quarantined events
        </div>
      )}
    </Lane>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/quarantine-lane.tsx
git commit -m "feat(web): add Quarantine lane for admin review"
```

---

## Sprint 3.8: Virtualization

**Goal:** Efficient rendering for large event lists.

### Task 13: Add virtualization to lanes

**Files:**
- Modify: `apps/web/src/components/lane.tsx`

**Step 1: Install react-virtual**

```bash
cd apps/web && pnpm add @tanstack/react-virtual
```

**Step 2: Update Lane component with virtualization**

```typescript
// apps/web/src/components/lane.tsx
"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface LaneProps {
  title: string;
  icon?: React.ReactNode;
  count: number;
  isLoading?: boolean;
  children: React.ReactNode[];
  estimateSize?: number;
}

export function Lane({
  title,
  icon,
  count,
  isLoading,
  children,
  estimateSize = 100,
}: LaneProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const items = Array.isArray(children) ? children : [children];

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        {icon}
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-sm">({count})</span>
      </div>

      {/* Virtualized content */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {items[virtualItem.index]}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/lane.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add virtualization to lanes for performance"
```

---

## Final Task: Update Documentation

### Task 14: Update ROADMAP.md

**Files:**
- Modify: `docs/ROADMAP.md`

Mark Phase 3 as complete with all sprint details.

**Step 1: Update roadmap**

**Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 3 Observatory Production as complete"
```

---

## Gate Verification

Before marking Phase 3 complete, verify:

1. **Lighthouse Performance ≥ 85**
   ```bash
   # Run in browser DevTools → Lighthouse
   ```

2. **Lighthouse Accessibility ≥ 90**

3. **Mobile verified on 375px**
   ```bash
   # Use browser responsive mode
   ```

4. **All tests pass**
   ```bash
   pnpm test
   ```

5. **Events load from database**
   ```bash
   curl -s 'https://v2.genai.hr/trpc/events.list?input={"json":{"limit":5}}'
   ```

6. **SSE connects successfully**
   ```bash
   curl -N 'https://v2.genai.hr/api/sse/events'
   ```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add Prisma to tRPC context | `packages/trpc/src/trpc.ts` |
| 2 | Extend event types | `packages/shared/src/types/feeds.ts` |
| 3 | Create events router tests | `packages/trpc/src/routers/__tests__/events.test.ts` |
| 4 | Rewrite events router | `packages/trpc/src/routers/events.ts` |
| 5 | Update API context | `apps/api/src/index.ts` |
| 6 | Add LLM runs router | `packages/trpc/src/routers/llm-runs.ts` |
| 7 | Add SSE endpoint | `apps/api/src/sse/events.ts` |
| 8 | Create useEventStream hook | `apps/web/src/hooks/use-event-stream.ts` |
| 9 | Wire Time Machine to DB | `apps/web/src/context/time-context.tsx` |
| 10 | Add lane config persistence | `apps/web/src/context/lane-config-context.tsx` |
| 11 | Create Transparency panel | `apps/web/src/components/transparency-panel.tsx` |
| 12 | Create Quarantine lane | `apps/web/src/components/quarantine-lane.tsx` |
| 13 | Add virtualization | `apps/web/src/components/lane.tsx` |
| 14 | Update documentation | `docs/ROADMAP.md` |
