# Phase 5: Explore - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build entity dossier-first exploration with optional relationship graph

**Architecture:** Entity pages are the primary navigation surface. Graph is secondary/optional. Follows Architecture Constitution #10: DOSSIER BEFORE GRAPH.

**Tech Stack:** Next.js (dynamic routes), tRPC (entity/search routers), Prisma (Entity model), React Force Graph (optional)

---

## Pre-implementation Context

**Existing Resources:**
- `packages/db/prisma/schema.prisma` - Entity, EntityAlias, EntityMention, Relationship models
- `packages/trpc/src/routers/entities.ts` - Basic entity router
- `packages/trpc/src/routers/search.ts` - Search router with instant search
- `apps/web/src/app/explore/[slug]/page.tsx` - Scaffold exists

**What Needs Creation:**
- Enhanced entity search with fuzzy matching
- Entity dossier page with full implementation
- Related entities component
- Events timeline for entity
- Optional graph visualization

---

## Tasks Overview

| Task | Focus | Files |
|------|-------|-------|
| 1 | Entity Search Enhancement | packages/trpc/src/routers/entities.ts |
| 2 | Entity Dossier Page | apps/web/src/app/explore/[slug]/page.tsx |
| 3 | Events Timeline Component | apps/web/src/components/entity/events-timeline.tsx |
| 4 | Related Entities Component | apps/web/src/components/entity/related-entities.tsx |
| 5 | Entity Graph Component | apps/web/src/components/entity/entity-graph.tsx |
| 6 | Graph Filters | apps/web/src/components/entity/graph-filters.tsx |
| 7 | Mobile Responsive | apps/web/src/app/explore/[slug]/page.tsx |

---

## Task 1: Entity Search Enhancement

**Files:**
- Modify: `packages/trpc/src/routers/entities.ts`
- Create: `packages/trpc/src/routers/__tests__/entities.test.ts`

**Step 1: Add fuzzy search procedure**

```typescript
// Add to entities router
fuzzySearch: publicProcedure
  .input(z.object({
    query: z.string().min(1),
    limit: z.number().min(1).max(50).default(10),
    types: z.array(z.nativeEnum(EntityType)).optional(),
  }))
  .query(async ({ ctx, input }) => {
    // Search by name and aliases with ILIKE
    const entities = await ctx.db.entity.findMany({
      where: {
        OR: [
          { name: { contains: input.query, mode: 'insensitive' } },
          { nameHr: { contains: input.query, mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: input.query, mode: 'insensitive' } } } },
        ],
        ...(input.types && { type: { in: input.types } }),
      },
      include: {
        aliases: true,
        _count: { select: { mentions: true } },
      },
      orderBy: { importance: 'desc' },
      take: input.limit,
    });

    return entities;
  }),
```

**Step 2: Add getBySlug procedure**

```typescript
bySlug: publicProcedure
  .input(z.string())
  .query(async ({ ctx, input }) => {
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
```

**Step 3: Write tests**

**Step 4: Run typecheck and tests**

```bash
pnpm typecheck && pnpm test
```

**Step 5: Commit**

```bash
git add packages/trpc/
git commit -m "feat(trpc): add fuzzy search and bySlug to entities router"
```

---

## Task 2: Entity Dossier Page

**Files:**
- Modify: `apps/web/src/app/explore/[slug]/page.tsx`

**Step 1: Implement full dossier page**

```typescript
"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { trpc } from "@/trpc";
import { EventsTimeline } from "@/components/entity/events-timeline";
import { RelatedEntities } from "@/components/entity/related-entities";
import { EntityGraph } from "@/components/entity/entity-graph";

// Entity type icons/colors
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
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className={`${config.color} text-white px-2 py-1 rounded text-sm`}>
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
            Također poznato kao: {entity.aliases.map(a => a.alias).join(", ")}
          </p>
        )}
      </header>

      {/* Description */}
      {entity.description && (
        <section className="mb-8">
          <p className="text-foreground">{entity.descriptionHr || entity.description}</p>
        </section>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Events timeline (2 cols) */}
        <div className="md:col-span-2">
          <EventsTimeline entityId={entity.id} entityName={entity.name} />
        </div>

        {/* Sidebar (1 col) */}
        <div className="space-y-8">
          <RelatedEntities entityId={entity.id} />
        </div>
      </div>

      {/* Graph section (collapsible on mobile) */}
      <section className="mt-8">
        <EntityGraph entityId={entity.id} entityName={entity.name} />
      </section>
    </div>
  );
}

function DossierSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-6 w-24 bg-muted rounded mb-2" />
      <div className="h-10 w-64 bg-muted rounded mb-2" />
      <div className="h-6 w-48 bg-muted rounded mb-8" />
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 h-96 bg-muted rounded" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );
}
```

**Step 2: Run typecheck**

**Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat(web): implement entity dossier page structure"
```

---

## Task 3: Events Timeline Component

**Files:**
- Create: `apps/web/src/components/entity/events-timeline.tsx`
- Create: `apps/web/src/components/entity/index.ts`

**Step 1: Add events by entity procedure to tRPC**

```typescript
// In packages/trpc/src/routers/events.ts
byEntity: publicProcedure
  .input(z.object({
    entityId: z.string(),
    role: z.enum(["SUBJECT", "OBJECT", "MENTIONED"]).optional(),
    limit: z.number().min(1).max(100).default(20),
    cursor: z.string().optional(),
  }))
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

**Step 2: Create EventsTimeline component**

```typescript
// apps/web/src/components/entity/events-timeline.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc";
import { ChevronRight } from "lucide-react";

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

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.events.byEntity.useInfiniteQuery(
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
          onChange={(e) => setRoleFilter(e.target.value as MentionRole || undefined)}
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
              <div className="h-3 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground">
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
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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

**Step 3: Create index export**

```typescript
// apps/web/src/components/entity/index.ts
export { EventsTimeline } from "./events-timeline";
export { RelatedEntities } from "./related-entities";
export { EntityGraph } from "./entity-graph";
```

**Step 4: Run typecheck and tests**

**Step 5: Commit**

```bash
git add packages/trpc/ apps/web/
git commit -m "feat(web): add events timeline for entity dossier"
```

---

## Task 4: Related Entities Component

**Files:**
- Create: `apps/web/src/components/entity/related-entities.tsx`
- Modify: `packages/trpc/src/routers/entities.ts`

**Step 1: Add related entities procedure**

```typescript
// In entities router
related: publicProcedure
  .input(z.object({
    entityId: z.string(),
    limit: z.number().min(1).max(20).default(10),
  }))
  .query(async ({ ctx, input }) => {
    // Get entities connected via relationships
    const relationships = await ctx.db.relationship.findMany({
      where: {
        OR: [
          { sourceId: input.entityId },
          { targetId: input.entityId },
        ],
        status: "APPROVED",
      },
      include: {
        source: true,
        target: true,
      },
    });

    // Count connections per entity
    const connectionCounts = new Map<string, { entity: typeof relationships[0]["source"]; count: number; types: Set<string> }>();

    for (const rel of relationships) {
      const otherId = rel.sourceId === input.entityId ? rel.targetId : rel.sourceId;
      const other = rel.sourceId === input.entityId ? rel.target : rel.source;

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

**Step 2: Create RelatedEntities component**

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
        {related.map(({ entity, connectionCount, relationshipTypes }) => {
          const config = typeConfig[entity.type] || { icon: "❓", color: "text-gray-500" };
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

**Step 3: Run typecheck and tests**

**Step 4: Commit**

```bash
git add packages/trpc/ apps/web/
git commit -m "feat(web): add related entities component for dossier"
```

---

## Task 5: Entity Graph Component

**Files:**
- Create: `apps/web/src/components/entity/entity-graph.tsx`
- Modify: `packages/trpc/src/routers/entities.ts`

**Step 1: Add graph data procedure**

```typescript
// In entities router
graphData: publicProcedure
  .input(z.object({
    entityId: z.string(),
    depth: z.number().min(1).max(3).default(1),
    maxNodes: z.number().min(10).max(100).default(50),
  }))
  .query(async ({ ctx, input }) => {
    // Get all relationships for entity (and neighbors if depth > 1)
    const relationships = await ctx.db.relationship.findMany({
      where: {
        OR: [
          { sourceId: input.entityId },
          { targetId: input.entityId },
        ],
        status: "APPROVED",
      },
      include: {
        source: true,
        target: true,
      },
      take: input.maxNodes,
    });

    // Build nodes and links
    const nodesMap = new Map<string, typeof relationships[0]["source"]>();
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

**Step 2: Create EntityGraph component (using simple SVG or react-force-graph-2d)**

```typescript
// apps/web/src/components/entity/entity-graph.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    { entityId, depth: 1, maxNodes: 30 },
    { enabled: isExpanded }
  );

  return (
    <section className="border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors"
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
            <div className="h-64 flex items-center justify-center">
              <span className="animate-pulse">Učitavam graf...</span>
            </div>
          ) : !data || data.nodes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nema podataka za graf
            </p>
          ) : (
            <div className="space-y-4">
              {/* Simple list view for now - can be replaced with actual graph */}
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
              <p className="text-xs text-muted-foreground">
                Napomena: Interaktivni graf bit će dodan u budućoj verziji
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

**Step 3: Run typecheck**

**Step 4: Commit**

```bash
git add packages/trpc/ apps/web/
git commit -m "feat(web): add entity graph component (list view)"
```

---

## Task 6: Graph Filters

**Files:**
- Create: `apps/web/src/components/entity/graph-filters.tsx`

**Step 1: Create filter component**

```typescript
// apps/web/src/components/entity/graph-filters.tsx
"use client";

interface GraphFiltersProps {
  entityTypes: string[];
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
  relationshipTypes: string[];
  selectedRelationships: string[];
  onRelationshipsChange: (types: string[]) => void;
}

const typeLabels: Record<string, string> = {
  COMPANY: "Tvrtke",
  LAB: "Laboratoriji",
  MODEL: "Modeli",
  PRODUCT: "Proizvodi",
  PERSON: "Osobe",
  REGULATION: "Regulativa",
  DATASET: "Datasetovi",
  BENCHMARK: "Benchmarkovi",
};

const relationshipLabels: Record<string, string> = {
  RELEASED: "Izdao",
  ANNOUNCED: "Najavio",
  PUBLISHED: "Objavio",
  PARTNERED: "Partner",
  INTEGRATED: "Integrirao",
  FUNDED: "Financirao",
  ACQUIRED: "Kupio",
  BANNED: "Zabranio",
  BEATS: "Pobjeđuje",
  CRITICIZED: "Kritizirao",
};

export function GraphFilters({
  entityTypes,
  selectedTypes,
  onTypesChange,
  relationshipTypes,
  selectedRelationships,
  onRelationshipsChange,
}: GraphFiltersProps) {
  const toggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const toggleRelationship = (type: string) => {
    if (selectedRelationships.includes(type)) {
      onRelationshipsChange(selectedRelationships.filter((t) => t !== type));
    } else {
      onRelationshipsChange([...selectedRelationships, type]);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div>
        <h3 className="text-sm font-medium mb-2">Vrste entiteta</h3>
        <div className="flex flex-wrap gap-2">
          {entityTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2 py-1 text-xs rounded ${
                selectedTypes.includes(type)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {typeLabels[type] || type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Vrste poveznica</h3>
        <div className="flex flex-wrap gap-2">
          {relationshipTypes.map((type) => (
            <button
              key={type}
              onClick={() => toggleRelationship(type)}
              className={`px-2 py-1 text-xs rounded ${
                selectedRelationships.includes(type)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {relationshipLabels[type] || type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add graph filters component"
```

---

## Task 7: Mobile Responsive

**Files:**
- Modify: `apps/web/src/app/explore/[slug]/page.tsx`

**Step 1: Add responsive layout**

- Stack sections vertically on mobile
- Hide graph by default on mobile (< 768px)
- Make events timeline full width
- Related entities below timeline on mobile

**Step 2: Test on 375px**

**Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat(web): make entity dossier mobile responsive"
```

---

## Verification

After implementing all tasks:

1. **Typecheck**
   ```bash
   pnpm typecheck
   ```

2. **Tests**
   ```bash
   pnpm test
   ```

3. **Manual testing**
   - Visit `/explore/openai` (assuming entity exists)
   - Verify events timeline loads
   - Verify related entities display
   - Verify graph section works
   - Test on 375px mobile

4. **Gate criteria**
   - Search "OpenAI" → dossier page renders ✓
   - Recent events show for entity ✓
   - Related entities clickable ✓
   - Works on 375px mobile ✓

---

## Architecture Constitution

Every future change must respect these principles:

**#10. DOSSIER BEFORE GRAPH**
Entity exploration is text-first (dossier page). Force-graph is optional, never primary navigation.

**#4. QUERY-SHAPED APIs**
tRPC for type-safe queries. No REST-first thinking.

**#3. STRUCTURED OVER TEXT**
All entity data comes from typed Prisma models.

---

## Dependencies

No new dependencies required for basic implementation.

Optional for full graph visualization:
- `react-force-graph-2d` - Force-directed graph
- `d3-force` - Force simulation (used internally)

---

## LLM Cost Estimate

This phase has no LLM costs - it's purely displaying existing data from the database.
