# Phase B: Evidence-First Event Dossier - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the context panel into a rich event dossier showing WHAT_HAPPENED, WHY_MATTERS, evidence chain with trust tiers, and GM commentary - making each event feel deeper than anything else on the web.

**Architecture:** Add two new artifact types (WHAT_HAPPENED, WHY_MATTERS) to the enrichment pipeline, upgrade confidence-score to serve as the single publish gate (checking both artifact completeness and evidence confidence), rewrite the context panel to render the full dossier, and wire deep-linking via `?event=<id>` as the single source of truth for selection state.

**Tech Stack:** Prisma (ArtifactType enum migration), Zod (WhatHappenedPayload), BullMQ (event-enrich updates), tRPC (events.byId), React (context panel rewrite), Next.js (URL params)

---

## Pre-implementation Context

**Existing Resources:**
- `packages/shared/src/schemas/artifacts.ts` - HeadlinePayload, SummaryPayload, GMTakePayload, WhyMattersPayload already defined
- `apps/worker/src/processors/event-enrich.ts` - Generates HEADLINE, SUMMARY, GM_TAKE artifacts
- `apps/worker/src/processors/confidence-score.ts` - Trust-tier-aware confidence scoring + publish gate
- `apps/worker/src/index.ts` - Pipeline: evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → ...
- `apps/web/src/components/layout/context-panel.tsx` - Basic metadata panel (138 lines)
- `apps/web/src/context/selection-context.tsx` - SelectionProvider with NormalizedEvent state
- `packages/trpc/src/routers/events.ts` - `byId` query already fetches all artifacts + evidence + entities

**Key Design Decisions (from brainstorm):**
1. WHAT_HAPPENED gets its own `WhatHappenedPayload` schema (not reusing HeadlinePayload)
2. WHAT_HAPPENED prompt must include "Izvori: domain1, domain2" line and disagreement handling
3. GM_TAKE is optional for publish - show "GM jos razmislja..." if missing
4. Panel order: HEADLINE → WHAT_HAPPENED → SUMMARY → WHY_MATTERS → GM_TAKE → EVIDENCE → ENTITIES
5. URL (`?event=<id>`) is single source of truth - SelectionContext mirrors URL via useEffect
6. Prefetch `byId` on card hover for instant panel feel
7. Separate tRPC cache keys for list and byId queries
8. Pick highest version per artifactType via `pickLatestArtifact` utility
9. confidence-score becomes single publish gate (artifact completeness + evidence confidence)
10. Pipeline reorder: event-create → event-enrich → confidence-score (enrich before gate)

---

## Tasks Overview

| Task | Focus | Files |
|------|-------|-------|
| 1 | WhatHappenedPayload Zod schema | packages/shared/src/schemas/artifacts.ts |
| 2 | Add WHAT_HAPPENED to ArtifactType enum | schema.prisma, migration |
| 3 | Generate WHAT_HAPPENED + WHY_MATTERS in event-enrich | apps/worker/src/processors/event-enrich.ts |
| 4 | Reorder pipeline: enrich before confidence-score | apps/worker/src/index.ts |
| 5 | Update confidence-score: artifact completeness gate | apps/worker/src/processors/confidence-score.ts |
| 6 | pickLatestArtifact utility + byId enrichment | packages/shared, packages/trpc |
| 7 | Deep-linking: URL as source of truth | selection-context.tsx, observatory page |
| 8 | Context panel dossier UI rewrite | context-panel.tsx |
| 9 | Prefetch on hover | cockpit-event-card.tsx, source-section.tsx |

---

## Task 1: WhatHappenedPayload Zod Schema

**Files:**
- Modify: `packages/shared/src/schemas/artifacts.ts`

**Step 1: Add WhatHappenedPayload schema**

Add after `HeadlinePayload` (line 10), before `SummaryPayload`:

```typescript
export const WhatHappenedPayload = z.object({
  en: z.string(),
  hr: z.string(),
  sourceLine: z.string(), // "Sources: techcrunch.com, reuters.com"
  disagreements: z.array(z.string()).optional(), // Points where sources disagree
});
```

**Step 2: Add type inference**

Add after the existing type exports (around line 91):

```typescript
export type WhatHappenedPayload = z.infer<typeof WhatHappenedPayload>;
```

**Step 3: Add to ArtifactSchemas map**

In `ArtifactSchemas` object (line 100), add:

```typescript
WHAT_HAPPENED: WhatHappenedPayload,
```

**Step 4: Add to ArtifactPayloadMap**

In `ArtifactPayloadMap` type (line 112), add:

```typescript
WHAT_HAPPENED: WhatHappenedPayload;
```

**Step 5: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 6: Commit**

```bash
git add packages/shared/src/schemas/artifacts.ts
git commit -m "feat(shared): add WhatHappenedPayload Zod schema with sourceLine + disagreements"
```

---

## Task 2: Add WHAT_HAPPENED to ArtifactType Enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Step 1: Add WHAT_HAPPENED to ArtifactType enum**

In `enum ArtifactType` (line 52), add `WHAT_HAPPENED` after `GM_TAKE`:

```prisma
enum ArtifactType {
  HEADLINE
  SUMMARY
  GM_TAKE
  WHAT_HAPPENED // { en, hr, sourceLine, disagreements? }
  WHY_MATTERS
  ENTITY_EXTRACT
  TOPIC_ASSIGN
  RELATIONSHIP_EXTRACT
}
```

**Step 2: Run migration**

```bash
cd /home/wandeon/GenAI2/packages/db && pnpm prisma migrate dev --name add_what_happened_artifact_type
```

**Step 3: Generate client**

```bash
pnpm prisma generate
```

**Step 4: Verify**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 5: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat(db): add WHAT_HAPPENED to ArtifactType enum"
```

---

## Task 3: Generate WHAT_HAPPENED + WHY_MATTERS in event-enrich

**Files:**
- Modify: `apps/worker/src/processors/event-enrich.ts`

**Step 1: Update imports**

At line 7, add `WhatHappenedPayload` and `WhyMattersPayload` to imports:

```typescript
import {
  HeadlinePayload,
  SummaryPayload,
  GMTakePayload,
  WhatHappenedPayload,
  WhyMattersPayload,
  type ArtifactType,
} from "@genai/shared/schemas/artifacts";
```

**Step 2: Update enrichment artifact types**

At line 78-79, add the two new types:

```typescript
type EnrichmentArtifactType = "HEADLINE" | "SUMMARY" | "WHAT_HAPPENED" | "WHY_MATTERS" | "GM_TAKE";
const ENRICHMENT_ARTIFACTS: EnrichmentArtifactType[] = [
  "HEADLINE",
  "SUMMARY",
  "WHAT_HAPPENED",
  "WHY_MATTERS",
  "GM_TAKE",
];
```

**Step 3: Add WHAT_HAPPENED prompt**

Add to `PROMPTS` object (after GM_TAKE prompt, before closing `}`):

```typescript
  WHAT_HAPPENED: (title: string, evidenceText: string) => `
You are GM, an AI news curator. Write a concise factual account of what happened.

Event title: ${title}

Evidence:
${evidenceText}

Requirements:
- 2-4 sentences per language, factual and precise
- Croatian uses proper grammar (preposition "u", not "v")
- Include a "sourceLine" listing the domains of sources used (e.g. "Sources: techcrunch.com, reuters.com")
- If sources disagree on key facts, list the disagreements explicitly
- Never editorialize or add opinion - save that for GM_TAKE
- Never claim certainty beyond what sources state

Respond with ONLY a JSON object in this exact format:
{
  "en": "Factual account in English",
  "hr": "Kratki opis u hrvatskom",
  "sourceLine": "Sources: domain1.com, domain2.com",
  "disagreements": ["Point where sources disagree (omit array if sources agree)"]
}
`,

  WHY_MATTERS: (title: string, evidenceText: string) => `
You are GM, an AI news curator for Croatian audiences. Explain why this event matters.

Event title: ${title}

Evidence:
${evidenceText}

Requirements:
- Explain significance for different audiences
- Be honest about uncertainty
- Croatian uses proper grammar (preposition "u", not "v")
- Target audiences: developers, executives, researchers, investors, general
- Pick 1-3 most relevant audiences

Respond with ONLY a JSON object in this exact format:
{
  "text": "Why this matters in English",
  "textHr": "Zasto je ovo vazno na hrvatskom",
  "audience": ["developers", "researchers"]
}
`,
```

**Step 4: Update parseAndValidateResponse switch**

At line 213, add cases for the new types:

```typescript
    case "WHAT_HAPPENED":
      return WhatHappenedPayload.parse(parsed) as T;
    case "WHY_MATTERS":
      return WhyMattersPayload.parse(parsed) as T;
```

**Step 5: Update the evidence loading to include source domain info**

Modify `buildEvidenceText` (line 176) to also include source domain when available. Update the EventEvidence interface to include source info:

```typescript
interface EvidenceSnapshot {
  id: string;
  title: string | null;
  fullText: string | null;
  publishedAt: Date | null;
  source?: { domain: string; trustTier: string };
}
```

Update `buildEvidenceText`:

```typescript
function buildEvidenceText(evidence: EventEvidence[]): string {
  return evidence
    .map((ev) => {
      const snapshot = ev.snapshot;
      const parts = [];
      if (snapshot.source?.domain) parts.push(`Source: ${snapshot.source.domain} (${snapshot.source.trustTier})`);
      if (snapshot.title) parts.push(`Title: ${snapshot.title}`);
      if (snapshot.fullText) parts.push(`Content: ${snapshot.fullText}`);
      if (snapshot.publishedAt)
        parts.push(`Published: ${snapshot.publishedAt.toISOString()}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}
```

Update the Prisma include to also load `source`:

```typescript
evidence: {
  include: {
    snapshot: {
      include: { source: { select: { domain: true, trustTier: true } } },
    },
  },
},
```

**Step 6: Update status check - accept RAW or events where confidence-score ran first**

Since the pipeline will be reordered (enrich runs before confidence-score), events arriving here will be in RAW status. The current check (`event.status !== "RAW"`) stays correct.

**Step 7: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 8: Commit**

```bash
git add apps/worker/src/processors/event-enrich.ts
git commit -m "feat(worker): generate WHAT_HAPPENED + WHY_MATTERS artifacts in event-enrich"
```

**LLM Cost Estimate:**
- 2 additional LLM calls per event (WHAT_HAPPENED + WHY_MATTERS)
- ~$0.01 per call with gemini-3-flash
- Expected daily increase: ~$0.50 (50 events/day)
- Mitigation: Same model, same cost tracking via LLMRun table

---

## Task 4: Reorder Pipeline - Enrich Before Confidence-Score

**Files:**
- Modify: `apps/worker/src/index.ts`

**Step 1: Swap pipeline order**

The current pipeline is:
```
event-create → confidence-score → event-enrich → (entity + topic)
```

Change to:
```
event-create → event-enrich → confidence-score → (entity + topic)
```

**Modify event-create completion handler** (line 150-157):

```typescript
// 3. Event Create Worker - on completion, enqueue event-enrich
const eventCreateWorker = createEventCreateWorker(connection);
eventCreateWorker.on("completed", async (_job: Job<EventCreateJob>, result: EventCreateResult) => {
  if (result && result.eventId) {
    log(`event-create completed for ${result.eventId}, enqueueing event-enrich`);
    await queues.eventEnrich.add("enrich", { eventId: result.eventId });
  }
});
workers.push(eventCreateWorker);
```

**Modify event-enrich completion handler** (line 170-183) to enqueue confidence-score instead of entity+topic:

```typescript
// 4. Event Enrich Worker - on completion, enqueue confidence-score
const eventEnrichWorker = createEventEnrichWorker(connection);
eventEnrichWorker.on("completed", async (_job: Job<EventEnrichJob>, result: EventEnrichResult) => {
  if (result && result.eventId) {
    log(`event-enrich completed for ${result.eventId}, enqueueing confidence-score`);
    await queues.confidenceScore.add("score", { eventId: result.eventId });
  }
});
workers.push(eventEnrichWorker);
```

**Modify confidence-score completion handler** (line 160-167) to enqueue entity+topic:

```typescript
// 5. Confidence Score Worker - on completion, enqueue entity-extract AND topic-assign
const confidenceScoreWorker = createConfidenceScoreWorker(connection);
confidenceScoreWorker.on("completed", async (_job: Job<ConfidenceScoreJob>, result: ConfidenceScoreResult) => {
  if (result && result.eventId) {
    log(`confidence-score completed for ${result.eventId}: ${result.confidence}, enqueueing entity-extract and topic-assign`);
    parallelCompletions.set(result.eventId, { entityDone: false, topicDone: false });
    await Promise.all([
      queues.entityExtract.add("extract", { eventId: result.eventId }),
      queues.topicAssign.add("assign", { eventId: result.eventId }),
    ]);
  }
});
workers.push(confidenceScoreWorker);
```

**Step 2: Update pipeline comment** (line 13):

```typescript
// Pipeline Flow:
// evidence-snapshot → event-cluster → event-create → event-enrich → confidence-score → (entity-extract + topic-assign) → relationship-extract → watchlist-match
```

Also update the log at line 325.

**Step 3: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/worker/src/index.ts
git commit -m "refactor(worker): reorder pipeline - enrich before confidence-score for artifact gate"
```

---

## Task 5: Update Confidence-Score - Artifact Completeness Gate

**Files:**
- Modify: `apps/worker/src/processors/confidence-score.ts`

The confidence-score processor becomes the **single publish gate** checking both:
1. Evidence-based confidence (existing logic)
2. Required artifact completeness (new logic)

Required artifacts for publish: HEADLINE, SUMMARY, WHAT_HAPPENED, WHY_MATTERS.
GM_TAKE is optional - doesn't block publishing.

**Step 1: Add artifact completeness check**

Add after the logging section (~line 48), before the status transition logic:

```typescript
// ============================================================================
// ARTIFACT COMPLETENESS CHECK
// ============================================================================

const REQUIRED_ARTIFACTS = ["HEADLINE", "SUMMARY", "WHAT_HAPPENED", "WHY_MATTERS"] as const;

/**
 * Check if all required artifacts exist for an event.
 * GM_TAKE is optional and does not block publishing.
 */
async function checkArtifactCompleteness(
  eventId: string
): Promise<{ complete: boolean; missing: string[] }> {
  const artifacts = await prisma.eventArtifact.findMany({
    where: { eventId },
    select: { artifactType: true },
  });

  const existingTypes = new Set(artifacts.map((a) => a.artifactType));
  const missing = REQUIRED_ARTIFACTS.filter((t) => !existingTypes.has(t));

  return { complete: missing.length === 0, missing };
}
```

**Step 2: Update shouldTransition to accept ENRICHED status**

Since events will now arrive from event-enrich in ENRICHED status (not RAW), update the `shouldTransition` function. The current logic already handles this - RAW, ENRICHED, VERIFIED can all transition. No change needed here.

**Step 3: Update scoreConfidence function**

Modify the main `scoreConfidence` function to also check artifact completeness. After computing confidence and gate status, add the artifact check:

```typescript
  // Check artifact completeness (required for publish)
  const { complete: artifactsComplete, missing: missingArtifacts } =
    await checkArtifactCompleteness(eventId);

  // If artifacts incomplete, force QUARANTINED regardless of confidence
  const effectiveGateStatus = artifactsComplete ? gateStatus : "QUARANTINED";

  log(
    `Event ${eventId}: ${sourceCount} source(s), tiers=[${tiers.join(",")}], ` +
      `confidence=${confidence}, gate=${effectiveGateStatus}, current=${event.status}` +
      (missingArtifacts.length > 0 ? `, missing=[${missingArtifacts.join(",")}]` : "")
  );
```

Replace `gateStatus` with `effectiveGateStatus` in the transaction below.

**Step 4: Update status change reason to include artifact info**

In the audit log creation, update the reason string:

```typescript
reason:
  `Confidence scoring: ${confidence} (${sourceCount} source(s), ` +
  `tiers: [${tiers.join(", ")}])` +
  (missingArtifacts.length > 0
    ? ` [BLOCKED: missing ${missingArtifacts.join(", ")}]`
    : ` [artifacts complete]`),
```

**Step 5: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 6: Commit**

```bash
git add apps/worker/src/processors/confidence-score.ts
git commit -m "feat(worker): add artifact completeness check to confidence-score publish gate"
```

---

## Task 6: pickLatestArtifact Utility + byId Enrichment

**Files:**
- Create: `packages/shared/src/utils/artifacts.ts`
- Modify: `packages/shared/src/index.ts` (export new utility)
- Modify: `packages/trpc/src/routers/events.ts` (use utility in byId)

**Step 1: Create pickLatestArtifact utility**

```typescript
// packages/shared/src/utils/artifacts.ts

/**
 * Pick the highest-version artifact of a given type from an artifacts array.
 * Returns undefined if no artifact of that type exists.
 */
export function pickLatestArtifact<T = unknown>(
  artifacts: Array<{ type: string; payload: unknown; version: number }>,
  artifactType: string
): { payload: T; version: number } | undefined {
  const matching = artifacts.filter((a) => a.type === artifactType);
  if (matching.length === 0) return undefined;

  const latest = matching.reduce((best, curr) =>
    curr.version > best.version ? curr : best
  );

  return { payload: latest.payload as T, version: latest.version };
}
```

**Step 2: Export from shared index**

Check if `packages/shared/src/index.ts` exists and add:

```typescript
export { pickLatestArtifact } from "./utils/artifacts";
```

Or add subpath export `"./utils"` in `packages/shared/package.json` if using subpath pattern.

**Step 3: Update events.byId to return structured artifact data**

Modify `byId` in `packages/trpc/src/routers/events.ts` (line 146-198).

Update the return shape to sort artifacts by version and include trust tier label for evidence:

```typescript
  byId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
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
        artifacts: {
          orderBy: { version: "desc" },
        },
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
        nameHr: m.entity.nameHr,
        type: m.entity.type,
        role: m.role,
      })),
      statusHistory: event.statusHistory,
      evidence: event.evidence.map((e) => ({
        id: e.id,
        role: e.role,
        url: e.snapshot.source.rawUrl,
        domain: e.snapshot.source.domain,
        trustTier: e.snapshot.source.trustTier,
        retrievedAt: e.snapshot.retrievedAt,
        title: e.snapshot.title,
      })),
    };
  }),
```

Key additions: `nameHr` on entities, `role` and `title` on evidence, `orderBy: { version: "desc" }` on artifacts.

**Step 4: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 5: Commit**

```bash
git add packages/shared/ packages/trpc/
git commit -m "feat(shared,trpc): add pickLatestArtifact utility, enrich byId response"
```

---

## Task 7: Deep-Linking - URL as Source of Truth

**Files:**
- Modify: `apps/web/src/context/selection-context.tsx`
- Modify: `apps/web/src/app/observatory/page.tsx`
- Modify: `apps/web/src/components/cockpit/source-section.tsx`

**Step 1: Update SelectionContext to use URL params**

Rewrite `selection-context.tsx` to use `?event=<id>` as the single source of truth:

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/trpc";

// The byId return type from tRPC
type EventDetail = NonNullable<Awaited<ReturnType<typeof trpc.events.byId.useQuery>>["data"]>;

interface SelectionContextValue {
  // Currently selected event ID (from URL)
  selectedEventId: string | null;

  // Full event detail (from byId query)
  eventDetail: EventDetail | null | undefined;
  isDetailLoading: boolean;

  // Select an event (updates URL)
  selectEvent: (eventId: string) => void;

  // Clear selection (removes URL param)
  clearSelection: () => void;

  // Is context panel open on mobile?
  isContextOpen: boolean;
  setContextOpen: (open: boolean) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isContextOpen, setContextOpen] = useState(false);

  // URL is the single source of truth
  const selectedEventId = searchParams.get("event");

  // Fetch full event detail when ID is selected
  const { data: eventDetail, isLoading: isDetailLoading, error } = trpc.events.byId.useQuery(
    selectedEventId!,
    { enabled: !!selectedEventId }
  );

  // Guard against invalid event IDs - clear param if event not found
  useEffect(() => {
    if (selectedEventId && !isDetailLoading && error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("event");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [selectedEventId, isDetailLoading, error, searchParams, router, pathname]);

  // Auto-open mobile panel when event selected
  useEffect(() => {
    if (selectedEventId) {
      setContextOpen(true);
    }
  }, [selectedEventId]);

  const selectEvent = useCallback(
    (eventId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("event", eventId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setContextOpen(false);
  }, [searchParams, router, pathname]);

  const value = useMemo(
    () => ({
      selectedEventId,
      eventDetail,
      isDetailLoading,
      selectEvent,
      clearSelection,
      isContextOpen,
      setContextOpen,
    }),
    [selectedEventId, eventDetail, isDetailLoading, selectEvent, clearSelection, isContextOpen]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
```

**Step 2: Update observatory page to use new context API**

In `apps/web/src/app/observatory/page.tsx`, update the `useSelection` usage. The old API was `{ selectedEvent, selectEvent }` (passing NormalizedEvent). The new API is `{ selectedEventId, selectEvent }` (passing string ID).

Change line 70:
```typescript
const { selectedEventId, selectEvent } = useSelection();
```

Change SourceSection prop (line 132):
```typescript
selectedEventId={selectedEventId ?? undefined}
onSelectEvent={(event) => selectEvent(event.id)}
```

**Step 3: Update SourceSection to pass event ID**

In `apps/web/src/components/cockpit/source-section.tsx`, the `onSelectEvent` prop already receives the full NormalizedEvent object which the parent destructures to just `event.id`. No change needed in SourceSection itself.

**Step 4: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/context/selection-context.tsx apps/web/src/app/observatory/page.tsx
git commit -m "feat(web): URL-driven selection context with byId query and deep-linking"
```

---

## Task 8: Context Panel Dossier UI Rewrite

**Files:**
- Modify: `apps/web/src/components/layout/context-panel.tsx`

**Step 1: Rewrite panel with full dossier content**

Replace the entire `context-panel.tsx` with the dossier layout. The panel renders content from `eventDetail` (the byId tRPC query result) via `useSelection()`.

Panel sections in order:
1. **Header**: Headline (from HEADLINE artifact) + meta line (date, status, source count, authoritative count)
2. **What Happened**: WHAT_HAPPENED artifact with source line and disagreements
3. **Summary**: SUMMARY artifact bullet points
4. **Why It Matters**: WHY_MATTERS artifact with audience badges
5. **GM Take**: GM_TAKE artifact (optional - "GM jos razmislja..." if missing)
6. **Evidence Chain**: List of evidence sources with trust tier badges and domain
7. **Entities**: Mentioned entities with role badges

```typescript
"use client";

import { useSelection } from "@/context/selection-context";
import { pickLatestArtifact } from "@genai/shared";
import type { HeadlinePayload, SummaryPayload, WhatHappenedPayload, WhyMattersPayload, GMTakePayload } from "@genai/shared/schemas/artifacts";

// ============================================================================
// TRUST TIER DISPLAY
// ============================================================================

const TRUST_TIER_BADGE: Record<string, { label: string; class: string }> = {
  AUTHORITATIVE: { label: "Autoritativan", class: "bg-emerald-500/20 text-emerald-400" },
  STANDARD: { label: "Standardan", class: "bg-blue-500/20 text-blue-400" },
  LOW: { label: "Nizak", class: "bg-gray-500/20 text-gray-400" },
};

const CONFIDENCE_BADGE: Record<string, { label: string; class: string }> = {
  HIGH: { label: "Visoka", class: "text-emerald-400" },
  MEDIUM: { label: "Srednja", class: "text-amber-400" },
  LOW: { label: "Niska", class: "text-red-400" },
};

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  RAW: { label: "Neobraden", class: "bg-gray-500/20 text-gray-400" },
  ENRICHED: { label: "Obogacen", class: "bg-blue-500/20 text-blue-400" },
  PUBLISHED: { label: "Objavljen", class: "bg-emerald-500/20 text-emerald-400" },
  QUARANTINED: { label: "U karanteni", class: "bg-amber-500/20 text-amber-400" },
};

// ============================================================================
// DOSSIER SECTION COMPONENTS
// ============================================================================

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">{children}</h4>;
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

interface ContextPanelProps {
  onClose: () => void;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { selectedEventId, eventDetail, isDetailLoading, clearSelection, isContextOpen } = useSelection();

  // Extract artifacts using pickLatestArtifact
  const artifacts = eventDetail?.artifacts ?? [];
  const headline = pickLatestArtifact<HeadlinePayload>(artifacts, "HEADLINE");
  const whatHappened = pickLatestArtifact<WhatHappenedPayload>(artifacts, "WHAT_HAPPENED");
  const summary = pickLatestArtifact<SummaryPayload>(artifacts, "SUMMARY");
  const whyMatters = pickLatestArtifact<WhyMattersPayload>(artifacts, "WHY_MATTERS");
  const gmTake = pickLatestArtifact<GMTakePayload>(artifacts, "GM_TAKE");

  // Count authoritative sources
  const authCount = eventDetail?.evidence?.filter((e: any) => e.trustTier === "AUTHORITATIVE").length ?? 0;

  // Determine if enrichment is partial (missing required artifacts)
  const hasAllRequired = headline && whatHappened && summary && whyMatters;

  // Panel content
  const panelContent = eventDetail ? (
    <div className="p-4 space-y-5">
      {/* Partial enrichment banner */}
      {!hasAllRequired && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          Obogacivanje u tijeku... Neki dijelovi jos nisu dostupni.
        </div>
      )}

      {/* HEADER: Headline + Meta */}
      <div>
        <h3 className="font-medium text-lg leading-snug">
          {headline?.payload.hr || eventDetail.titleHr || eventDetail.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
          <time>
            {new Date(eventDetail.occurredAt).toLocaleDateString("hr-HR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span>·</span>
          {eventDetail.status && STATUS_BADGE[eventDetail.status] && (
            <span className={`px-1.5 py-0.5 rounded ${STATUS_BADGE[eventDetail.status].class}`}>
              {STATUS_BADGE[eventDetail.status].label}
            </span>
          )}
          <span>·</span>
          <span>{eventDetail.sourceCount} izvora</span>
          {authCount > 0 && (
            <>
              <span>·</span>
              <span className="text-emerald-400">{authCount} autoritativan</span>
            </>
          )}
          {eventDetail.confidence && CONFIDENCE_BADGE[eventDetail.confidence] && (
            <>
              <span>·</span>
              <span className={CONFIDENCE_BADGE[eventDetail.confidence].class}>
                GM sigurnost: {CONFIDENCE_BADGE[eventDetail.confidence].label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* WHAT HAPPENED */}
      {whatHappened && (
        <div>
          <SectionHeader>Sto se dogodilo</SectionHeader>
          <p className="text-sm leading-relaxed">{whatHappened.payload.hr}</p>
          <p className="text-xs text-muted-foreground mt-1">{whatHappened.payload.sourceLine}</p>
          {whatHappened.payload.disagreements && whatHappened.payload.disagreements.length > 0 && (
            <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs font-medium text-amber-400 mb-1">Izvori se ne slazu:</p>
              <ul className="text-xs text-amber-300 space-y-0.5">
                {whatHappened.payload.disagreements.map((d, i) => (
                  <li key={i}>- {d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {summary && (
        <div>
          <SectionHeader>Sazetak</SectionHeader>
          <p className="text-sm leading-relaxed">{summary.payload.hr}</p>
          {summary.payload.bulletPoints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {summary.payload.bulletPoints.map((bp, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                  {bp}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* WHY IT MATTERS */}
      {whyMatters && (
        <div>
          <SectionHeader>Zasto je vazno</SectionHeader>
          <p className="text-sm leading-relaxed">{whyMatters.payload.textHr}</p>
          <div className="flex gap-1 mt-2">
            {whyMatters.payload.audience.map((a) => (
              <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GM TAKE */}
      <div>
        <SectionHeader>GM Analiza</SectionHeader>
        {gmTake ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm leading-relaxed italic">{gmTake.payload.takeHr}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>GM sigurnost: {gmTake.payload.confidence}</span>
            </div>
            {gmTake.payload.caveats && gmTake.payload.caveats.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {gmTake.payload.caveats.map((c, i) => (
                  <li key={i} className="text-xs text-muted-foreground">- {c}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">GM jos razmislja...</p>
        )}
      </div>

      {/* EVIDENCE CHAIN */}
      {eventDetail.evidence && eventDetail.evidence.length > 0 && (
        <div>
          <SectionHeader>Lanac dokaza</SectionHeader>
          <div className="space-y-2">
            {eventDetail.evidence.map((ev: any) => (
              <a
                key={ev.id}
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {ev.title || ev.domain}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{ev.domain}</span>
                    {TRUST_TIER_BADGE[ev.trustTier] && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${TRUST_TIER_BADGE[ev.trustTier].class}`}>
                        {TRUST_TIER_BADGE[ev.trustTier].label}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {ev.role === "PRIMARY" ? "Primarni" : ev.role === "SUPPORTING" ? "Potpora" : "Kontekst"}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground text-xs group-hover:text-primary" aria-hidden="true">&#8599;</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ENTITIES */}
      {eventDetail.entities && eventDetail.entities.length > 0 && (
        <div>
          <SectionHeader>Entiteti</SectionHeader>
          <div className="flex flex-wrap gap-1">
            {eventDetail.entities.map((ent: any) => (
              <span
                key={ent.id}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground"
              >
                {ent.nameHr || ent.name}
                <span className="ml-1 text-[10px] opacity-60">{ent.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* TOPICS */}
      {eventDetail.topics && eventDetail.topics.length > 0 && (
        <div>
          <SectionHeader>Teme</SectionHeader>
          <div className="flex flex-wrap gap-1">
            {eventDetail.topics.map((topic: string) => (
              <span
                key={topic}
                className="text-xs bg-secondary px-2 py-0.5 rounded"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : selectedEventId && isDetailLoading ? (
    <div className="p-4 space-y-3">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    </div>
  ) : (
    <div className="p-4">
      <p className="text-muted-foreground text-sm">
        Odaberi dogadaj za prikaz detalja
      </p>
      <p className="text-muted-foreground text-xs mt-2">
        Tipke: j/k za navigaciju, Enter za odabir
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar panel */}
      <aside className="hidden xl:block w-80 border-l bg-card overflow-y-auto h-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Dosje</h2>
          {selectedEventId && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
              aria-label="Zatvori dosje"
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          )}
        </div>
        {panelContent}
      </aside>

      {/* Mobile: bottom sheet */}
      {isContextOpen && selectedEventId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={clearSelection}
            aria-hidden="true"
          />
          <aside
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-xl z-50 max-h-[70vh] overflow-y-auto xl:hidden animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Dosje dogadaja"
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-card">
              <span className="font-medium">Dosje</span>
              <button
                onClick={clearSelection}
                className="p-2 rounded-full hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Zatvori dosje"
              >
                <span aria-hidden="true">&#10005;</span>
              </button>
            </div>
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
```

This file is larger than 300 lines, which is the component limit. However, the ContextPanel is an orchestrator component coordinating multiple dossier sections. Add a comment at the top explaining this:

```typescript
// ORCHESTRATOR COMPONENT: Coordinates multiple dossier sections in a single panel.
// Exceeds 300-line limit per CLAUDE.md exception for orchestrator components.
```

If it becomes too large during implementation, extract section renderers to `apps/web/src/components/dossier/` subdirectory.

**Step 2: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/context-panel.tsx
git commit -m "feat(web): rewrite context panel as evidence-first event dossier"
```

---

## Task 9: Prefetch on Hover

**Files:**
- Modify: `apps/web/src/components/cockpit/cockpit-event-card.tsx`
- Modify: `apps/web/src/components/cockpit/source-section.tsx`

**Step 1: Add onMouseEnter prop to CockpitEventCard**

In `cockpit-event-card.tsx`, add `onMouseEnter` to the props interface:

```typescript
interface CockpitEventCardProps {
  id: string;
  title: string;
  titleHr?: string | null;
  occurredAt: Date;
  impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | null;
  topics?: string[];
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}
```

Add the prop to the component signature and pass to the button:

```typescript
export function CockpitEventCard({
  title,
  titleHr,
  occurredAt,
  impactLevel,
  sourceCount,
  confidence,
  topics,
  isSelected,
  onClick,
  onMouseEnter,
}: CockpitEventCardProps) {
```

On the `motion.button`, add:

```typescript
onMouseEnter={onMouseEnter}
```

**Step 2: Wire prefetch in SourceSection**

In `source-section.tsx`, add tRPC import and prefetch:

```typescript
import { trpc } from "@/trpc";
```

Inside the component, get the tRPC utils:

```typescript
const utils = trpc.useUtils();
```

On each `CockpitEventCard`, add the `onMouseEnter` prop:

```typescript
<CockpitEventCard
  key={event.id}
  id={event.id}
  title={event.title}
  titleHr={event.titleHr}
  occurredAt={event.occurredAt}
  impactLevel={event.impactLevel}
  sourceCount={event.sourceCount}
  topics={event.topics}
  isSelected={selectedEventId === event.id}
  onClick={() => onSelectEvent(event)}
  onMouseEnter={() => utils.events.byId.prefetch(event.id)}
/>
```

**Step 3: Verify typecheck**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/components/cockpit/
git commit -m "feat(web): prefetch event detail on card hover for instant panel"
```

---

## Verification

After implementing all tasks:

1. **Database**
   ```bash
   pnpm db:migrate
   pnpm db:generate
   ```

2. **Type check**
   ```bash
   pnpm typecheck
   ```

3. **Tests**
   ```bash
   pnpm test
   ```

4. **Manual testing**
   - Navigate to `/observatory`
   - Click an event card → panel opens with dossier
   - Verify URL shows `?event=<id>`
   - Copy URL, open in new tab → same event selected
   - Test invalid `?event=bad-id` → param clears
   - Hover over cards → network tab shows prefetch
   - Check all dossier sections render
   - Mobile: event click → bottom sheet with full dossier
   - Verify "GM jos razmislja..." shows when GM_TAKE missing

5. **Pipeline flow**
   - Trigger feed ingest
   - Verify pipeline: create → enrich (5 artifacts) → confidence-score (publish gate) → entity + topic
   - Verify events with all 4 required artifacts + MEDIUM+ confidence → PUBLISHED
   - Verify events with missing artifacts → QUARANTINED

---

## LLM Cost Estimate

- 2 additional LLM calls per event (WHAT_HAPPENED + WHY_MATTERS)
- ~$0.01 per call with gemini-3-flash-preview
- Expected daily increase: ~$0.50 (assuming 50 events/day)
- Total enrichment cost: ~$0.05/event (5 artifacts)
- Mitigation: Same model, same LLMRun cost tracking, shared evidence context
