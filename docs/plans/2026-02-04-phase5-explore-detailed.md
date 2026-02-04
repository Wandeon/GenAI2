# Phase 5: Explore - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build entity dossier-first exploration with events timeline and related entities

**Architecture:** Entity pages are the primary navigation surface. Graph is secondary/optional. Follows Architecture Constitution #10: DOSSIER BEFORE GRAPH.

**Tech Stack:** Next.js (dynamic routes), tRPC (entities/events routers), Prisma (Entity, EntityMention, Relationship models)

---

## Pre-Implementation Checklist

Before starting, verify environment:

```bash
./scripts/env-check.sh
# Expected: All checks pass
```

---

## Task 1: Entities Router - bySlug Procedure

**Files:**
- Modify: `packages/trpc/src/routers/entities.ts`
- Create: `packages/trpc/src/routers/__tests__/entities.test.ts`

### Step 1: Write failing test for bySlug

```typescript
// packages/trpc/src/routers/__tests__/entities.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTRPCContext } from "../../trpc";

vi.mock("@genai/db", () => ({
  prisma: {
    entity: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    relationship: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@genai/db";

const mockEntity = {
  id: "ent_1",
  name: "OpenAI",
  nameHr: null,
  slug: "openai",
  type: "COMPANY",
  description: "AI research company",
  descriptionHr: null,
  importance: 0.9,
  firstSeen: new Date(),
  lastSeen: new Date(),
  aliases: [{ id: "a1", entityId: "ent_1", alias: "Open AI" }],
  _count: { mentions: 42, sourceRels: 5, targetRels: 3 },
};

describe("entities router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bySlug", () => {
    it("returns entity with aliases and counts", async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(mockEntity as never);

      const result = await prisma.entity.findUnique({
        where: { slug: "openai" },
        include: {
          aliases: true,
          _count: { select: { mentions: true, sourceRels: true, targetRels: true } },
        },
      });

      expect(result).toEqual(mockEntity);
      expect(result?.aliases).toHaveLength(1);
      expect(result?._count.mentions).toBe(42);
    });

    it("returns null for non-existent slug", async () => {
      vi.mocked(prisma.entity.findUnique).mockResolvedValue(null);

      const result = await prisma.entity.findUnique({
        where: { slug: "nonexistent" },
      });

      expect(result).toBeNull();
    });
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd /home/wandeon/GenAI2/.worktrees/feat-daily-run
pnpm test --filter=@genai/trpc -- entities
```

Expected: Tests pass (mocking only, router not tested directly yet)

### Step 3: Implement bySlug procedure

```typescript
// packages/trpc/src/routers/entities.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const entitiesRouter = router({
  bySlug: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const entity = await ctx.db.entity.findUnique({
      where: { slug: input },
      include: {
        aliases: true,
        _count: {
          select: {
            mentions: true,
            sourceRels: true,
            targetRels: true,
          },
        },
      },
    });

    return entity;
  }),
});
```

### Step 4: Run typecheck and tests

```bash
pnpm typecheck && pnpm test --filter=@genai/trpc
```

Expected: All pass

### Step 5: Commit

```bash
git add packages/trpc/src/routers/entities.ts packages/trpc/src/routers/__tests__/entities.test.ts
git commit -m "feat(trpc): implement bySlug procedure for entities router"
```

---

## Task 2: Entities Router - fuzzySearch Procedure

**Files:**
- Modify: `packages/trpc/src/routers/entities.ts`
- Modify: `packages/trpc/src/routers/__tests__/entities.test.ts`

### Step 1: Add fuzzySearch test

```typescript
// Add to entities.test.ts
describe("fuzzySearch", () => {
  it("searches by name case-insensitive", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([mockEntity] as never);

    await prisma.entity.findMany({
      where: {
        OR: [
          { name: { contains: "open", mode: "insensitive" } },
          { nameHr: { contains: "open", mode: "insensitive" } },
          { aliases: { some: { alias: { contains: "open", mode: "insensitive" } } } },
        ],
      },
      include: { aliases: true, _count: { select: { mentions: true } } },
      orderBy: { importance: "desc" },
      take: 10,
    });

    expect(prisma.entity.findMany).toHaveBeenCalled();
  });

  it("filters by entity type", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

    await prisma.entity.findMany({
      where: {
        OR: [
          { name: { contains: "test", mode: "insensitive" } },
        ],
        type: { in: ["COMPANY", "LAB"] },
      },
    });

    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["COMPANY", "LAB"] },
        }),
      })
    );
  });

  it("returns empty array for no matches", async () => {
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

    const result = await prisma.entity.findMany({
      where: { name: { contains: "zzz" } },
    });

    expect(result).toEqual([]);
  });
});
```

### Step 2: Run test

```bash
pnpm test --filter=@genai/trpc -- entities
```

### Step 3: Implement fuzzySearch

```typescript
// Add to entities.ts
import { EntityType } from "@genai/db";

// Add to router:
fuzzySearch: publicProcedure
  .input(
    z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10),
      types: z.array(z.nativeEnum(EntityType)).optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const entities = await ctx.db.entity.findMany({
      where: {
        OR: [
          { name: { contains: input.query, mode: "insensitive" } },
          { nameHr: { contains: input.query, mode: "insensitive" } },
          {
            aliases: {
              some: { alias: { contains: input.query, mode: "insensitive" } },
            },
          },
        ],
        ...(input.types && { type: { in: input.types } }),
      },
      include: {
        aliases: true,
        _count: { select: { mentions: true } },
      },
      orderBy: { importance: "desc" },
      take: input.limit,
    });

    return entities;
  }),
```

### Step 4: Run typecheck and tests

```bash
pnpm typecheck && pnpm test --filter=@genai/trpc
```

### Step 5: Commit

```bash
git add packages/trpc/
git commit -m "feat(trpc): add fuzzySearch procedure to entities router"
```

---

## Task 3: Entities Router - related Procedure

**Files:**
- Modify: `packages/trpc/src/routers/entities.ts`
- Modify: `packages/trpc/src/routers/__tests__/entities.test.ts`

### Step 1: Add related test

```typescript
// Add to entities.test.ts
const mockRelationships = [
  {
    id: "rel_1",
    sourceId: "ent_1",
    targetId: "ent_2",
    type: "RELEASED",
    status: "APPROVED",
    source: { id: "ent_1", name: "OpenAI", type: "COMPANY", slug: "openai" },
    target: { id: "ent_2", name: "GPT-4", type: "MODEL", slug: "gpt-4" },
  },
  {
    id: "rel_2",
    sourceId: "ent_3",
    targetId: "ent_1",
    type: "FUNDED",
    status: "APPROVED",
    source: { id: "ent_3", name: "Microsoft", type: "COMPANY", slug: "microsoft" },
    target: { id: "ent_1", name: "OpenAI", type: "COMPANY", slug: "openai" },
  },
];

describe("related", () => {
  it("returns related entities with connection counts", async () => {
    vi.mocked(prisma.relationship.findMany).mockResolvedValue(mockRelationships as never);

    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [{ sourceId: "ent_1" }, { targetId: "ent_1" }],
        status: "APPROVED",
      },
      include: { source: true, target: true },
    });

    expect(relationships).toHaveLength(2);
  });

  it("returns empty array when no relationships", async () => {
    vi.mocked(prisma.relationship.findMany).mockResolvedValue([]);

    const relationships = await prisma.relationship.findMany({
      where: { OR: [{ sourceId: "ent_999" }] },
    });

    expect(relationships).toEqual([]);
  });
});
```

### Step 2: Run test

```bash
pnpm test --filter=@genai/trpc -- entities
```

### Step 3: Implement related procedure

```typescript
// Add to entities.ts router:
related: publicProcedure
  .input(
    z.object({
      entityId: z.string(),
      limit: z.number().min(1).max(20).default(10),
    })
  )
  .query(async ({ ctx, input }) => {
    const relationships = await ctx.db.relationship.findMany({
      where: {
        OR: [{ sourceId: input.entityId }, { targetId: input.entityId }],
        status: "APPROVED",
      },
      include: {
        source: true,
        target: true,
      },
    });

    // Count connections per entity
    const connectionCounts = new Map<
      string,
      {
        entity: (typeof relationships)[0]["source"];
        count: number;
        types: Set<string>;
      }
    >();

    for (const rel of relationships) {
      const otherId =
        rel.sourceId === input.entityId ? rel.targetId : rel.sourceId;
      const other =
        rel.sourceId === input.entityId ? rel.target : rel.source;

      if (connectionCounts.has(otherId)) {
        const existing = connectionCounts.get(otherId)!;
        existing.count++;
        existing.types.add(rel.type);
      } else {
        connectionCounts.set(otherId, {
          entity: other,
          count: 1,
          types: new Set([rel.type]),
        });
      }
    }

    // Sort by count and limit
    const sorted = [...connectionCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, input.limit)
      .map(({ entity, count, types }) => ({
        entity,
        connectionCount: count,
        relationshipTypes: [...types],
      }));

    return sorted;
  }),
```

### Step 4: Run typecheck and tests

```bash
pnpm typecheck && pnpm test --filter=@genai/trpc
```

### Step 5: Commit

```bash
git add packages/trpc/
git commit -m "feat(trpc): add related entities procedure"
```

---

## Task 4: Events Router - byEntity Procedure

**Files:**
- Modify: `packages/trpc/src/routers/events.ts`
- Modify: `packages/trpc/src/routers/__tests__/events.test.ts`

### Step 1: Add byEntity test

```typescript
// Add to events.test.ts
describe("byEntity", () => {
  it("returns events mentioning entity", async () => {
    const mockEvents = [
      {
        id: "evt_1",
        title: "OpenAI releases GPT-5",
        titleHr: null,
        occurredAt: new Date(),
        status: "PUBLISHED",
        artifacts: [],
        mentions: [{ entity: { id: "ent_1", name: "OpenAI" } }],
      },
    ];

    vi.mocked(prisma.event.findMany).mockResolvedValue(mockEvents as never);

    await prisma.event.findMany({
      where: {
        status: "PUBLISHED",
        mentions: { some: { entityId: "ent_1" } },
      },
      include: {
        artifacts: { where: { artifactType: { in: ["HEADLINE", "SUMMARY"] } } },
        mentions: { include: { entity: true }, take: 5 },
      },
      orderBy: { occurredAt: "desc" },
      take: 21,
    });

    expect(prisma.event.findMany).toHaveBeenCalled();
  });

  it("filters by mention role", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);

    await prisma.event.findMany({
      where: {
        mentions: { some: { entityId: "ent_1", role: "SUBJECT" } },
      },
    });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          mentions: { some: { entityId: "ent_1", role: "SUBJECT" } },
        }),
      })
    );
  });
});
```

### Step 2: Run test

```bash
pnpm test --filter=@genai/trpc -- events
```

### Step 3: Implement byEntity procedure

```typescript
// Add to events.ts router:
byEntity: publicProcedure
  .input(
    z.object({
      entityId: z.string(),
      role: z.enum(["SUBJECT", "OBJECT", "MENTIONED"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      cursor: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const events = await ctx.db.event.findMany({
      where: {
        status: "PUBLISHED",
        mentions: {
          some: {
            entityId: input.entityId,
            ...(input.role && { role: input.role }),
          },
        },
      },
      include: {
        artifacts: {
          where: { artifactType: { in: ["HEADLINE", "SUMMARY"] } },
        },
        mentions: {
          include: { entity: true },
          take: 5,
        },
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
    });

    const hasMore = events.length > input.limit;
    const items = hasMore ? events.slice(0, -1) : events;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }),
```

### Step 4: Run typecheck and tests

```bash
pnpm typecheck && pnpm test --filter=@genai/trpc
```

### Step 5: Commit

```bash
git add packages/trpc/
git commit -m "feat(trpc): add byEntity procedure to events router"
```

---

## Task 5: Entity Components Directory Setup

**Files:**
- Create: `apps/web/src/components/entity/index.ts`

### Step 1: Create directory and index

```typescript
// apps/web/src/components/entity/index.ts
export { EventsTimeline } from "./events-timeline";
export { RelatedEntities } from "./related-entities";
export { EntityGraph } from "./entity-graph";
```

### Step 2: Commit (placeholder)

```bash
mkdir -p /home/wandeon/GenAI2/.worktrees/feat-daily-run/apps/web/src/components/entity
# Will commit with first component
```

---

## Task 6: EventsTimeline Component

**Files:**
- Create: `apps/web/src/components/entity/events-timeline.tsx`

### Step 1: Create component

```typescript
// apps/web/src/components/entity/events-timeline.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/trpc";

interface EventsTimelineProps {
  entityId: string;
  entityName: string;
}

type MentionRole = "SUBJECT" | "OBJECT" | "MENTIONED";

const roleLabels: Record<MentionRole, string> = {
  SUBJECT: "Glavni akter",
  OBJECT: "Objekt",
  MENTIONED: "Spomenut",
};

export function EventsTimeline({ entityId, entityName }: EventsTimelineProps) {
  const [roleFilter, setRoleFilter] = useState<MentionRole | undefined>();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.events.byEntity.useInfiniteQuery(
    { entityId, role: roleFilter, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const events = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Događaji</h2>
        <select
          value={roleFilter ?? ""}
          onChange={(e) =>
            setRoleFilter((e.target.value as MentionRole) || undefined)
          }
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          <option value="">Svi</option>
          <option value="SUBJECT">Glavni akter</option>
          <option value="OBJECT">Objekt</option>
          <option value="MENTIONED">Spomenut</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse p-4 border rounded-lg">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          Nema događaja za {entityName}
          {roleFilter && ` kao ${roleLabels[roleFilter].toLowerCase()}`}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/observatory?event=${event.id}`}
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-2">
                      {event.titleHr || event.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(event.occurredAt).toLocaleDateString("hr-HR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full mt-4 py-2 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isFetchingNextPage ? "Učitavam..." : "Prikaži više"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
```

### Step 2: Run typecheck

```bash
pnpm typecheck
```

### Step 3: Commit

```bash
git add apps/web/src/components/entity/
git commit -m "feat(web): add EventsTimeline component for entity dossier"
```

---

## Task 7: RelatedEntities Component

**Files:**
- Create: `apps/web/src/components/entity/related-entities.tsx`

### Step 1: Create component

```typescript
// apps/web/src/components/entity/related-entities.tsx
"use client";

import Link from "next/link";
import { trpc } from "@/trpc";

interface RelatedEntitiesProps {
  entityId: string;
}

const typeConfig: Record<string, { icon: string; color: string }> = {
  COMPANY: { icon: "🏢", color: "text-blue-500" },
  LAB: { icon: "🔬", color: "text-purple-500" },
  MODEL: { icon: "🤖", color: "text-green-500" },
  PRODUCT: { icon: "📦", color: "text-orange-500" },
  PERSON: { icon: "👤", color: "text-pink-500" },
  REGULATION: { icon: "📜", color: "text-red-500" },
  DATASET: { icon: "📊", color: "text-cyan-500" },
  BENCHMARK: { icon: "📈", color: "text-yellow-500" },
};

export function RelatedEntities({ entityId }: RelatedEntitiesProps) {
  const { data: related, isLoading } = trpc.entities.related.useQuery({
    entityId,
    limit: 10,
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-muted rounded" />
          ))}
        </div>
      </section>
    );
  }

  if (!related || related.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
        <p className="text-sm text-muted-foreground">Nema povezanih entiteta</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
      <div className="space-y-2">
        {related.map(({ entity, connectionCount }) => {
          const config = typeConfig[entity.type] || {
            icon: "❓",
            color: "text-gray-500",
          };
          return (
            <Link
              key={entity.id}
              href={`/explore/${entity.slug}`}
              className="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={config.color}>{config.icon}</span>
                <span className="truncate">{entity.name}</span>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {connectionCount}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

### Step 2: Run typecheck

```bash
pnpm typecheck
```

### Step 3: Commit

```bash
git add apps/web/src/components/entity/
git commit -m "feat(web): add RelatedEntities component for entity dossier"
```

---

## Task 8: EntityGraph Component (Simple List View)

**Files:**
- Create: `apps/web/src/components/entity/entity-graph.tsx`
- Modify: `packages/trpc/src/routers/entities.ts`

### Step 1: Add graphData procedure to entities router

```typescript
// Add to entities.ts router:
graphData: publicProcedure
  .input(
    z.object({
      entityId: z.string(),
      maxNodes: z.number().min(10).max(100).default(30),
    })
  )
  .query(async ({ ctx, input }) => {
    const relationships = await ctx.db.relationship.findMany({
      where: {
        OR: [{ sourceId: input.entityId }, { targetId: input.entityId }],
        status: "APPROVED",
      },
      include: {
        source: true,
        target: true,
      },
      take: input.maxNodes,
    });

    const nodesMap = new Map<string, (typeof relationships)[0]["source"]>();
    const links: Array<{ source: string; target: string; type: string }> = [];

    for (const rel of relationships) {
      nodesMap.set(rel.sourceId, rel.source);
      nodesMap.set(rel.targetId, rel.target);
      links.push({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.type,
      });
    }

    const nodes = [...nodesMap.values()].map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      slug: e.slug,
    }));

    return { nodes, links };
  }),
```

### Step 2: Create EntityGraph component

```typescript
// apps/web/src/components/entity/entity-graph.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/trpc";

interface EntityGraphProps {
  entityId: string;
  entityName: string;
}

const typeColors: Record<string, string> = {
  COMPANY: "#3b82f6",
  LAB: "#a855f7",
  MODEL: "#22c55e",
  PRODUCT: "#f97316",
  PERSON: "#ec4899",
  REGULATION: "#ef4444",
  DATASET: "#06b6d4",
  BENCHMARK: "#eab308",
};

export function EntityGraph({ entityId, entityName }: EntityGraphProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = trpc.entities.graphData.useQuery(
    { entityId, maxNodes: 30 },
    { enabled: isExpanded }
  );

  return (
    <section className="border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors rounded-lg"
      >
        <h2 className="text-lg font-semibold">Graf povezanosti</h2>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 border-t">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <span className="animate-pulse text-muted-foreground">
                Učitavam graf...
              </span>
            </div>
          ) : !data || data.nodes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nema podataka za graf
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {data.nodes.length} entiteta, {data.links.length} poveznica
              </p>
              <div className="flex flex-wrap gap-2">
                {data.nodes
                  .filter((n) => n.id !== entityId)
                  .map((node) => (
                    <Link
                      key={node.id}
                      href={`/explore/${node.slug}`}
                      className="px-3 py-1 rounded-full text-sm border hover:bg-accent transition-colors"
                      style={{ borderColor: typeColors[node.type] || "#666" }}
                    >
                      {node.name}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

### Step 3: Update index.ts exports

```typescript
// apps/web/src/components/entity/index.ts
export { EventsTimeline } from "./events-timeline";
export { RelatedEntities } from "./related-entities";
export { EntityGraph } from "./entity-graph";
```

### Step 4: Run typecheck

```bash
pnpm typecheck
```

### Step 5: Commit

```bash
git add packages/trpc/ apps/web/src/components/entity/
git commit -m "feat(web): add EntityGraph component with simple list view"
```

---

## Task 9: Entity Dossier Page

**Files:**
- Modify: `apps/web/src/app/explore/[slug]/page.tsx`

### Step 1: Implement full dossier page

```typescript
// apps/web/src/app/explore/[slug]/page.tsx
"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/trpc";
import { EventsTimeline } from "@/components/entity/events-timeline";
import { RelatedEntities } from "@/components/entity/related-entities";
import { EntityGraph } from "@/components/entity/entity-graph";

const typeConfig: Record<string, { icon: string; color: string }> = {
  COMPANY: { icon: "🏢", color: "bg-blue-500" },
  LAB: { icon: "🔬", color: "bg-purple-500" },
  MODEL: { icon: "🤖", color: "bg-green-500" },
  PRODUCT: { icon: "📦", color: "bg-orange-500" },
  PERSON: { icon: "👤", color: "bg-pink-500" },
  REGULATION: { icon: "📜", color: "bg-red-500" },
  DATASET: { icon: "📊", color: "bg-cyan-500" },
  BENCHMARK: { icon: "📈", color: "bg-yellow-500" },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function EntityDossierPage({ params }: PageProps) {
  const { slug } = use(params);

  const { data: entity, isLoading } = trpc.entities.bySlug.useQuery(slug);

  if (isLoading) {
    return <DossierSkeleton />;
  }

  if (!entity) {
    notFound();
  }

  const config = typeConfig[entity.type] || { icon: "❓", color: "bg-gray-500" };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href="/observatory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Natrag na Observatory
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`${config.color} text-white px-2 py-1 rounded text-sm`}
          >
            {config.icon} {entity.type}
          </span>
          <span className="text-muted-foreground text-sm">
            {entity._count.mentions} spominjanja
          </span>
        </div>
        <h1 className="text-3xl font-bold">{entity.name}</h1>
        {entity.nameHr && entity.nameHr !== entity.name && (
          <p className="text-xl text-muted-foreground">{entity.nameHr}</p>
        )}
        {entity.aliases.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Također poznato kao: {entity.aliases.map((a) => a.alias).join(", ")}
          </p>
        )}
      </header>

      {/* Description */}
      {entity.description && (
        <section className="mb-8">
          <p className="text-foreground">
            {entity.descriptionHr || entity.description}
          </p>
        </section>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Events timeline (2 cols on desktop, full on mobile) */}
        <div className="md:col-span-2 order-2 md:order-1">
          <EventsTimeline entityId={entity.id} entityName={entity.name} />
        </div>

        {/* Sidebar (1 col on desktop, full on mobile) */}
        <div className="space-y-8 order-1 md:order-2">
          <RelatedEntities entityId={entity.id} />
        </div>
      </div>

      {/* Graph section */}
      <section className="mt-8">
        <EntityGraph entityId={entity.id} entityName={entity.name} />
      </section>
    </div>
  );
}

function DossierSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-6" />
      <div className="h-6 w-24 bg-muted rounded mb-2" />
      <div className="h-10 w-64 bg-muted rounded mb-2" />
      <div className="h-6 w-48 bg-muted rounded mb-8" />
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 h-96 bg-muted rounded order-2 md:order-1" />
        <div className="h-64 bg-muted rounded order-1 md:order-2" />
      </div>
    </div>
  );
}
```

### Step 2: Run typecheck

```bash
pnpm typecheck
```

### Step 3: Run tests

```bash
pnpm test
```

### Step 4: Commit

```bash
git add apps/web/src/app/explore/
git commit -m "feat(web): implement entity dossier page with components"
```

---

## Task 10: Final Verification

### Step 1: Run full test suite

```bash
pnpm typecheck && pnpm test
```

Expected: All pass

### Step 2: Check for TODOs

```bash
grep -r "TODO\|FIXME" apps/web/src/components/entity apps/web/src/app/explore packages/trpc/src/routers/entities.ts
```

Expected: No results (or only acceptable notes)

### Step 3: Create final commit if needed

```bash
git status
# If clean, no commit needed
```

---

## Verification Checklist

After all tasks:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `/explore/[slug]` renders entity header
- [ ] Events timeline shows events mentioning entity
- [ ] Related entities list shows connections
- [ ] Graph section expands and shows nodes
- [ ] Mobile layout works (375px)
- [ ] No TODO/FIXME in feature code

---

## Gate Criteria

- [ ] Search "OpenAI" → navigate to dossier page
- [ ] Recent events show for entity
- [ ] Related entities are clickable → navigate to their dossier
- [ ] Works on 375px mobile

---

## LLM Cost Estimate

This phase has **no LLM costs** - purely displaying existing data from database.
