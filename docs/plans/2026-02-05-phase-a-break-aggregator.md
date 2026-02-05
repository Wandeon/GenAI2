# Phase A: Break the Aggregator Pattern - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform GenAI from a per-URL article aggregator into an evidence-backed world model where many sources cluster into one event with a computed confidence level and publish gate.

**Architecture:** New `event-cluster` processor sits between `evidence-snapshot` and `event-create` in the pipeline. It uses a single LLM call to compare each incoming snapshot against N recent candidate events (prefiltered by title similarity + time window). If the LLM judges a match, the snapshot becomes SUPPORTING evidence on the existing event; otherwise a new event is created. After clustering, a `confidence-score` processor computes a trust-tier-aware confidence level (HIGH/MEDIUM/LOW) and applies the publish gate (HIGH/MEDIUM → PUBLISHED, LOW → QUARANTINED).

**Tech Stack:** Prisma (schema changes), BullMQ (new processors), Zod (validation), tRPC (query changes), Tailwind (UI badge)

---

## Pre-implementation Context

**Existing Resources:**
- `apps/worker/src/processors/event-create.ts` - Current fingerprint-based dedup (243 lines)
- `apps/worker/src/processors/evidence-snapshot.ts` - Creates snapshots with trust tier (326 lines)
- `apps/worker/src/index.ts` - Pipeline orchestration (293 lines)
- `packages/db/prisma/schema.prisma` - Event model at line 129 (404 lines total)
- `packages/trpc/src/routers/events.ts` - Events router with toNormalizedEvent (314 lines)
- `packages/shared/src/types/feeds.ts` - NormalizedEvent type (141 lines)
- `apps/web/src/components/cockpit/cockpit-event-card.tsx` - Event card UI (86 lines)

**What Needs Creation:**
- `ConfidenceLevel` enum in Prisma schema
- `Event.confidence` field + `Event.sourceCount` cached field
- `ClusterDecision` Zod schema for LLM output validation
- `event-cluster` processor (new pipeline step)
- `confidence-score` processor (new pipeline step)
- Confidence badge in UI

**Current Pipeline:**
```
evidence-snapshot → event-create → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match
```

**New Pipeline:**
```
evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → ...
```

**LLM Cost Estimate:**
- ~1 LLM call per snapshot (single-call judge with N candidates)
- Input: ~500 tokens (prompt + candidates), Output: ~100 tokens
- Cost: ~$0.005 per snapshot at Gemini Flash rates
- Daily cost: ~480 snapshots/ingest × ~$0.005 = ~$2.40/day
- Mitigation: Prefilter reduces candidates to 5-10, short-circuits on exact fingerprint match

---

## Tasks Overview

| Task | Focus | Files |
|------|-------|-------|
| 1 | Schema: ConfidenceLevel + Event fields | schema.prisma, migration |
| 2 | ClusterDecision Zod schema | packages/shared/src/schemas/cluster.ts |
| 3 | Confidence scoring function | packages/shared/src/confidence.ts |
| 4 | Event-cluster processor | apps/worker/src/processors/event-cluster.ts |
| 5 | Confidence-score processor | apps/worker/src/processors/confidence-score.ts |
| 6 | Pipeline rewiring | apps/worker/src/index.ts |
| 7 | tRPC + NormalizedEvent updates | events router + types |
| 8 | UI confidence badge | cockpit-event-card.tsx |

---

## Task 1: Schema Changes

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Step 1: Add ConfidenceLevel enum**

Add after `ImpactLevel` enum (line 40):

```prisma
enum ConfidenceLevel {
  HIGH         // 2+ sources with AUTHORITATIVE or STANDARD tier
  MEDIUM       // 1 AUTHORITATIVE or 2+ any tier
  LOW          // Single non-authoritative source
}
```

**Step 2: Add fields to Event model**

Add after `importance` field (line 136):

```prisma
  confidence  ConfidenceLevel?           // Computed by confidence-score processor
  sourceCount Int             @default(1) // Cached count of evidence links (derived)
```

**Step 3: Run migration**

```bash
cd /home/wandeon/GenAI2/packages/db && pnpm prisma migrate dev --name add_confidence_level
```

**Step 4: Generate Prisma client**

```bash
cd /home/wandeon/GenAI2/packages/db && pnpm prisma generate
```

**Step 5: Verify types compile**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 6: Commit**

```bash
git add packages/db/prisma/
git commit -m "feat(db): add ConfidenceLevel enum and Event.confidence + sourceCount fields"
```

---

## Task 2: ClusterDecision Zod Schema

**Files:**
- Create: `packages/shared/src/schemas/cluster.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Step 1: Create the cluster schema file**

```typescript
// packages/shared/src/schemas/cluster.ts
import { z } from "zod";

/**
 * ClusterDecision - LLM judge output for event clustering.
 *
 * The judge receives ONE incoming snapshot and N candidate events.
 * It returns either the ID of the best-matching event or null for "new event".
 */
export const ClusterDecisionSchema = z.object({
  // The eventId of the best match, or null if no match
  matchedEventId: z.string().nullable(),

  // Confidence in the clustering decision (0-1)
  confidence: z.number().min(0).max(1),

  // Short explanation of why this decision was made
  reason: z.string().max(200),
});

export type ClusterDecision = z.infer<typeof ClusterDecisionSchema>;
```

**Step 2: Export from schemas index**

Add to `packages/shared/src/schemas/index.ts`:

```typescript
export * from "./cluster";
```

**Step 3: Verify types compile**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 4: Commit**

```bash
git add packages/shared/src/schemas/
git commit -m "feat(shared): add ClusterDecision Zod schema for LLM judge output"
```

---

## Task 3: Confidence Scoring Function

**Files:**
- Create: `packages/shared/src/confidence.ts`
- Modify: `packages/shared/src/index.ts` (if it exists) or verify export

This is the trust-tier-aware confidence rubric. It does NOT use model confidence - only source count and trust tiers.

**Step 1: Create the confidence scoring module**

```typescript
// packages/shared/src/confidence.ts

/**
 * Confidence scoring rubric - trust-tier-aware.
 *
 * Rules (from user spec):
 * - 1 AUTHORITATIVE source → HIGH
 * - 3+ sources with at least 1 STANDARD or above → HIGH
 * - 2 sources with at least 1 STANDARD or above → MEDIUM
 * - 2+ LOW-only sources → MEDIUM
 * - 1 STANDARD source → MEDIUM
 * - 1 LOW source → LOW
 *
 * The confidence level determines the publish gate:
 * - HIGH → PUBLISHED
 * - MEDIUM → PUBLISHED
 * - LOW → QUARANTINED
 */

export type TrustTier = "AUTHORITATIVE" | "STANDARD" | "LOW";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface EvidenceTrustProfile {
  /** Total number of evidence links */
  sourceCount: number;
  /** Trust tiers of all evidence sources */
  tiers: TrustTier[];
}

export function computeConfidence(profile: EvidenceTrustProfile): ConfidenceLevel {
  const { sourceCount, tiers } = profile;

  if (sourceCount === 0) return "LOW";

  const hasAuthoritative = tiers.includes("AUTHORITATIVE");
  const hasStandard = tiers.includes("STANDARD");
  const standardOrAboveCount = tiers.filter(
    (t) => t === "AUTHORITATIVE" || t === "STANDARD"
  ).length;

  // 1 AUTHORITATIVE → HIGH
  if (hasAuthoritative) return "HIGH";

  // 3+ sources with at least 1 STANDARD → HIGH
  if (sourceCount >= 3 && hasStandard) return "HIGH";

  // 2+ sources with at least 1 STANDARD → MEDIUM
  if (sourceCount >= 2 && standardOrAboveCount >= 1) return "MEDIUM";

  // 2+ LOW-only sources → MEDIUM (corroboration even from weak sources)
  if (sourceCount >= 2) return "MEDIUM";

  // 1 STANDARD → MEDIUM
  if (hasStandard) return "MEDIUM";

  // 1 LOW → LOW
  return "LOW";
}

/**
 * Determine whether an event should be published or quarantined.
 *
 * @returns "PUBLISHED" or "QUARANTINED"
 */
export function confidenceToStatus(
  confidence: ConfidenceLevel
): "PUBLISHED" | "QUARANTINED" {
  return confidence === "LOW" ? "QUARANTINED" : "PUBLISHED";
}
```

**Step 2: Write tests for confidence scoring**

Create: `packages/shared/src/__tests__/confidence.test.ts`

```typescript
// packages/shared/src/__tests__/confidence.test.ts
import { describe, it, expect } from "vitest";
import { computeConfidence, confidenceToStatus } from "../confidence";
import type { EvidenceTrustProfile } from "../confidence";

describe("computeConfidence", () => {
  it("returns HIGH for 1 AUTHORITATIVE source", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 1,
      tiers: ["AUTHORITATIVE"],
    };
    expect(computeConfidence(profile)).toBe("HIGH");
  });

  it("returns HIGH for 3+ sources with at least 1 STANDARD", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 3,
      tiers: ["STANDARD", "LOW", "LOW"],
    };
    expect(computeConfidence(profile)).toBe("HIGH");
  });

  it("returns MEDIUM for 2 sources with 1 STANDARD", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 2,
      tiers: ["STANDARD", "LOW"],
    };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns MEDIUM for 2 LOW-only sources", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 2,
      tiers: ["LOW", "LOW"],
    };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns MEDIUM for 1 STANDARD source", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 1,
      tiers: ["STANDARD"],
    };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns LOW for 1 LOW source", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 1,
      tiers: ["LOW"],
    };
    expect(computeConfidence(profile)).toBe("LOW");
  });

  it("returns LOW for 0 sources", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 0,
      tiers: [],
    };
    expect(computeConfidence(profile)).toBe("LOW");
  });

  it("returns HIGH for AUTHORITATIVE even with single source", () => {
    const profile: EvidenceTrustProfile = {
      sourceCount: 1,
      tiers: ["AUTHORITATIVE"],
    };
    expect(computeConfidence(profile)).toBe("HIGH");
  });

  it("returns HIGH for 3 LOW sources with no STANDARD", () => {
    // 3+ LOW-only → still only MEDIUM (no STANDARD present)
    const profile: EvidenceTrustProfile = {
      sourceCount: 3,
      tiers: ["LOW", "LOW", "LOW"],
    };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });
});

describe("confidenceToStatus", () => {
  it("maps HIGH → PUBLISHED", () => {
    expect(confidenceToStatus("HIGH")).toBe("PUBLISHED");
  });

  it("maps MEDIUM → PUBLISHED", () => {
    expect(confidenceToStatus("MEDIUM")).toBe("PUBLISHED");
  });

  it("maps LOW → QUARANTINED", () => {
    expect(confidenceToStatus("LOW")).toBe("QUARANTINED");
  });
});
```

**Step 3: Check if shared package has vitest config, add if missing**

Check for `packages/shared/vitest.config.ts`. If it doesn't exist, create it:

```typescript
// packages/shared/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

**Step 4: Run tests**

```bash
cd /home/wandeon/GenAI2/packages/shared && pnpm test
```

Expected: All 9 confidence tests pass.

**Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add trust-tier-aware confidence scoring with tests"
```

---

## Task 4: Event-Cluster Processor

**Files:**
- Create: `apps/worker/src/processors/event-cluster.ts`

This is the core of Phase A. The processor:
1. Receives a snapshot ID
2. Prefilters candidate events by title similarity + time window (no entities - they don't exist yet at this pipeline stage)
3. Makes ONE LLM call with all candidates
4. Returns either a matched eventId or null (create new)

**Idempotency note:** If the same snapshot is processed twice (e.g., worker restart), the processor checks if an EventEvidence link already exists for this snapshot. If so, it short-circuits.

**Concurrency note:** Two snapshots about the same story may arrive simultaneously. The fingerprint UNIQUE constraint in event-create handles this - if both try to create, one wins and the other becomes SUPPORTING evidence via the duplicate path.

**Step 1: Create the processor file**

```typescript
// apps/worker/src/processors/event-cluster.ts
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import { ClusterDecisionSchema } from "@genai/shared/schemas/cluster";
import { createDefaultLLMClient, hashString, calculateLLMCost } from "@genai/llm";
import type { LLMClient } from "@genai/llm";

// ============================================================================
// EVENT CLUSTER PROCESSOR
// ============================================================================
// Sits between evidence-snapshot and event-create.
// Uses LLM-as-judge to decide: does this snapshot belong to an existing event?
//
// Pipeline position: evidence-snapshot → [event-cluster] → event-create
//
// Idempotency: Checks if snapshot already has an EventEvidence link.
// Concurrency: Fingerprint UNIQUE constraint prevents duplicate events.

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EventClusterJob {
  snapshotId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  publishedAt?: string; // ISO date string
}

export interface EventClusterResult {
  snapshotId: string;
  matchedEventId: string | null;
  decision: "matched" | "new" | "skipped";
  /** Pass through to event-create */
  sourceType: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROCESSOR_NAME = "event-cluster";
const TIME_WINDOW_HOURS = 72; // Look back 3 days for candidates
const MAX_CANDIDATES = 10;
const TITLE_SIMILARITY_THRESHOLD = 0.15; // Minimum bigram overlap to be a candidate

// ============================================================================
// LOGGING
// ============================================================================

function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[event-cluster] ${message}`);
}

// ============================================================================
// TITLE SIMILARITY (cheap prefilter - bigram overlap)
// ============================================================================

function getBigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const words = normalized.split(/\s+/);
  const bigrams = new Set<string>();
  for (const word of words) {
    for (let i = 0; i < word.length - 1; i++) {
      bigrams.add(word.slice(i, i + 2));
    }
  }
  return bigrams;
}

export function titleSimilarity(a: string, b: string): number {
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

// ============================================================================
// LLM JUDGE PROMPT (single call with N candidates)
// ============================================================================

function buildJudgePrompt(
  incomingTitle: string,
  candidates: Array<{ id: string; title: string; sourceCount: number }>
): string {
  const candidateList = candidates
    .map((c, i) => `  ${i + 1}. [${c.id}] "${c.title}" (${c.sourceCount} source${c.sourceCount > 1 ? "s" : ""})`)
    .join("\n");

  return `You are an event deduplication judge for an AI news observatory.

INCOMING SNAPSHOT:
"${incomingTitle}"

CANDIDATE EVENTS (may describe the same real-world event):
${candidateList}

TASK: Decide if the incoming snapshot describes the SAME real-world event as any candidate.

Rules:
- Same event = same announcement, release, funding round, paper, etc.
- Different coverage angles of the SAME event = MATCH
- Related but distinct events = NO MATCH (e.g., "OpenAI releases GPT-5" vs "OpenAI hires new CTO")
- When uncertain, prefer NO MATCH (false negatives are cheaper than false positives)

Respond with ONLY a JSON object:
{
  "matchedEventId": "<event ID from list>" or null,
  "confidence": <0.0 to 1.0>,
  "reason": "<brief explanation, max 200 chars>"
}`;
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

export async function clusterSnapshot(
  job: EventClusterJob,
  client?: LLMClient
): Promise<EventClusterResult> {
  const { snapshotId, sourceType, sourceId, title, publishedAt } = job;

  log(`Clustering snapshot ${snapshotId}: "${title.slice(0, 60)}..."`);

  // Idempotency: check if this snapshot already has an evidence link
  const existingLink = await prisma.eventEvidence.findFirst({
    where: { snapshotId },
  });
  if (existingLink) {
    log(`Snapshot ${snapshotId} already linked to event ${existingLink.eventId}, skipping`);
    return {
      snapshotId,
      matchedEventId: existingLink.eventId,
      decision: "skipped",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }

  // Time window for candidate search
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - TIME_WINDOW_HOURS);

  // Fetch recent events as candidates
  const recentEvents = await prisma.event.findMany({
    where: {
      occurredAt: { gte: windowStart },
      status: { in: ["RAW", "ENRICHED", "VERIFIED", "PUBLISHED"] },
    },
    select: {
      id: true,
      title: true,
      sourceCount: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 100, // Fetch more, then prefilter
  });

  // Prefilter by title similarity (cheap, no LLM cost)
  const candidates = recentEvents
    .map((e) => ({
      ...e,
      similarity: titleSimilarity(title, e.title),
    }))
    .filter((e) => e.similarity >= TITLE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CANDIDATES);

  // If no candidates pass prefilter → definitely a new event, skip LLM
  if (candidates.length === 0) {
    log(`No similar candidates for "${title.slice(0, 40)}...", creating new event`);
    return {
      snapshotId,
      matchedEventId: null,
      decision: "new",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }

  // Single LLM call with all candidates
  const llmClient = client || createDefaultLLMClient();
  const prompt = buildJudgePrompt(
    title,
    candidates.map((c) => ({ id: c.id, title: c.title, sourceCount: c.sourceCount }))
  );
  const promptHash = hashString(prompt);
  const inputHash = hashString(title);

  const startTime = Date.now();
  let response;
  try {
    response = await llmClient.complete(prompt);
  } catch (error) {
    // LLM failure → safe default: treat as new event
    log(`LLM judge failed: ${error}, defaulting to new event`);
    return {
      snapshotId,
      matchedEventId: null,
      decision: "new",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }
  const latencyMs = Date.now() - startTime;

  // Parse LLM response
  let decision;
  try {
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
    decision = ClusterDecisionSchema.parse(JSON.parse(jsonStr.trim()));
  } catch (error) {
    log(`Failed to parse judge response: ${error}, defaulting to new event`);
    return {
      snapshotId,
      matchedEventId: null,
      decision: "new",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }

  // Log the LLM run for observability
  await prisma.lLMRun.create({
    data: {
      provider: llmClient.provider,
      model: llmClient.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      costCents: calculateLLMCost(
        response.usage.inputTokens,
        response.usage.outputTokens
      ),
      latencyMs,
      promptHash,
      inputHash,
      processorName: PROCESSOR_NAME,
    },
  });

  // Validate that matchedEventId actually exists in our candidates
  if (
    decision.matchedEventId &&
    !candidates.some((c) => c.id === decision.matchedEventId)
  ) {
    log(`LLM returned unknown event ID ${decision.matchedEventId}, treating as new`);
    return {
      snapshotId,
      matchedEventId: null,
      decision: "new",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }

  if (decision.matchedEventId) {
    log(`Matched to event ${decision.matchedEventId} (confidence: ${decision.confidence}, reason: ${decision.reason})`);
  } else {
    log(`No match found (reason: ${decision.reason}), creating new event`);
  }

  return {
    snapshotId,
    matchedEventId: decision.matchedEventId,
    decision: decision.matchedEventId ? "matched" : "new",
    sourceType,
    sourceId,
    title,
    publishedAt,
  };
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

export async function processEventCluster(
  job: Job<EventClusterJob>
): Promise<EventClusterResult> {
  return clusterSnapshot(job.data);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

export function createEventClusterWorker(connection: ConnectionOptions): Worker {
  return new Worker("event-cluster", processEventCluster, {
    connection,
  });
}
```

**Step 2: Write tests for titleSimilarity**

Create: `apps/worker/src/processors/__tests__/event-cluster.test.ts`

```typescript
// apps/worker/src/processors/__tests__/event-cluster.test.ts
import { describe, it, expect } from "vitest";
import { titleSimilarity } from "../event-cluster";

describe("titleSimilarity", () => {
  it("returns 1.0 for identical titles", () => {
    const score = titleSimilarity("OpenAI releases GPT-5", "OpenAI releases GPT-5");
    expect(score).toBe(1.0);
  });

  it("returns high score for similar titles", () => {
    const score = titleSimilarity(
      "OpenAI releases GPT-5 with improved reasoning",
      "OpenAI launches GPT-5 featuring better reasoning"
    );
    expect(score).toBeGreaterThan(0.3);
  });

  it("returns low score for unrelated titles", () => {
    const score = titleSimilarity(
      "OpenAI releases GPT-5",
      "Meta open-sources Llama 4"
    );
    expect(score).toBeLessThan(0.15);
  });

  it("returns 0 for empty strings", () => {
    expect(titleSimilarity("", "something")).toBe(0);
    expect(titleSimilarity("something", "")).toBe(0);
  });

  it("is case insensitive", () => {
    const a = titleSimilarity("OpenAI GPT", "openai gpt");
    expect(a).toBe(1.0);
  });
});
```

**Step 3: Add vitest config for worker if missing**

Check for `apps/worker/vitest.config.ts`. If it doesn't exist, create it:

```typescript
// apps/worker/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 10000,
  },
});
```

**Step 4: Run tests**

```bash
cd /home/wandeon/GenAI2/apps/worker && pnpm test
```

Expected: All titleSimilarity tests pass.

**Step 5: Commit**

```bash
git add apps/worker/src/processors/
git commit -m "feat(worker): add event-cluster processor with LLM-as-judge"
```

---

## Task 5: Confidence-Score Processor

**Files:**
- Create: `apps/worker/src/processors/confidence-score.ts`

This processor runs after `event-create`. It:
1. Loads all evidence links for the event
2. Resolves trust tiers via snapshot → source
3. Calls `computeConfidence()` from shared
4. Updates `Event.confidence`, `Event.sourceCount`, and applies publish gate

**Step 1: Create the processor file**

```typescript
// apps/worker/src/processors/confidence-score.ts
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import {
  computeConfidence,
  confidenceToStatus,
} from "@genai/shared/confidence";
import type { TrustTier } from "@genai/shared/confidence";

// ============================================================================
// CONFIDENCE SCORE PROCESSOR
// ============================================================================
// Runs after event-create. Computes trust-tier-aware confidence level
// and applies the publish gate (HIGH/MEDIUM → PUBLISHED, LOW → QUARANTINED).
//
// Pipeline position: event-create → [confidence-score] → event-enrich

export interface ConfidenceScoreJob {
  eventId: string;
}

export interface ConfidenceScoreResult {
  eventId: string;
  confidence: string;
  sourceCount: number;
  newStatus: string;
}

const PROCESSOR_NAME = "confidence-score";

function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[confidence-score] ${message}`);
}

export async function scoreConfidence(
  eventId: string
): Promise<ConfidenceScoreResult> {
  log(`Scoring confidence for event ${eventId}`);

  // Load event with all evidence → snapshot → source (for trust tier)
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      evidence: {
        include: {
          snapshot: {
            include: { source: true },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  // Build trust profile from evidence
  const tiers: TrustTier[] = event.evidence.map(
    (e) => e.snapshot.source.trustTier as TrustTier
  );
  const sourceCount = event.evidence.length;

  const confidence = computeConfidence({ sourceCount, tiers });
  const targetStatus = confidenceToStatus(confidence);

  // Only transition if the event is still RAW (don't regress published events)
  // This check also provides idempotency - re-running on an already-scored event is safe
  const shouldTransition =
    event.status === "RAW" ||
    // Allow re-scoring if confidence improved (e.g., new evidence added)
    (event.status === "QUARANTINED" && targetStatus === "PUBLISHED");

  if (shouldTransition) {
    await prisma.$transaction([
      prisma.event.update({
        where: { id: eventId },
        data: {
          confidence,
          sourceCount,
          status: targetStatus,
        },
      }),
      prisma.eventStatusChange.create({
        data: {
          eventId,
          fromStatus: event.status,
          toStatus: targetStatus,
          reason: `Confidence: ${confidence} (${sourceCount} source${sourceCount > 1 ? "s" : ""}, tiers: ${tiers.join(",")})`,
          changedBy: PROCESSOR_NAME,
        },
      }),
    ]);

    log(`Event ${eventId}: confidence=${confidence}, sourceCount=${sourceCount}, status=${event.status}→${targetStatus}`);
  } else {
    // Still update cached sourceCount and confidence even if status doesn't change
    await prisma.event.update({
      where: { id: eventId },
      data: { confidence, sourceCount },
    });

    log(`Event ${eventId}: confidence=${confidence}, sourceCount=${sourceCount}, status unchanged (${event.status})`);
  }

  return {
    eventId,
    confidence,
    sourceCount,
    newStatus: shouldTransition ? targetStatus : event.status,
  };
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

export async function processConfidenceScore(
  job: Job<ConfidenceScoreJob>
): Promise<ConfidenceScoreResult> {
  return scoreConfidence(job.data.eventId);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

export function createConfidenceScoreWorker(connection: ConnectionOptions): Worker {
  return new Worker("confidence-score", processConfidenceScore, {
    connection,
  });
}
```

**Step 2: Verify types compile**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 3: Commit**

```bash
git add apps/worker/src/processors/confidence-score.ts
git commit -m "feat(worker): add confidence-score processor with trust-tier-aware rubric"
```

---

## Task 6: Pipeline Rewiring

**Files:**
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/processors/event-create.ts` (minor: handle matched case)

The new pipeline flow:
```
evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → ...
```

Key changes:
1. Insert `event-cluster` queue/worker between evidence-snapshot and event-create
2. Insert `confidence-score` queue/worker between event-create and event-enrich
3. When `event-cluster` returns a match, `event-create` adds SUPPORTING evidence (existing dedup path)
4. When `event-cluster` returns null, `event-create` creates a new event (existing new path)
5. `confidence-score` always runs after event-create (for both new and matched events)

**Step 1: Update event-create to accept an optional matchedEventId**

In `apps/worker/src/processors/event-create.ts`, add `matchedEventId` to the job interface:

Add to `EventCreateJob` (line 16-24):

```typescript
export interface EventCreateJob {
  snapshotId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  titleHr?: string;
  occurredAt: string;
  impactLevel?: string;
  matchedEventId?: string; // From event-cluster: if set, add as SUPPORTING evidence
}
```

Update `EventCreateInput` (line 26-34):

```typescript
export interface EventCreateInput {
  title: string;
  titleHr?: string;
  occurredAt: Date;
  sourceType: SourceType;
  sourceId: string;
  snapshotId: string;
  impactLevel?: ImpactLevel;
  matchedEventId?: string;
}
```

Update `createEvent` function (line 116-192). Before the fingerprint check, add a fast path for matched events:

```typescript
export async function createEvent(
  input: EventCreateInput
): Promise<EventCreateResult> {
  const { title, titleHr, occurredAt, sourceType, sourceId, snapshotId, impactLevel, matchedEventId } =
    input;

  // Fast path: if event-cluster already matched to an existing event
  if (matchedEventId) {
    return prisma.$transaction(async (tx) => {
      const existingEvent = await tx.event.findUnique({
        where: { id: matchedEventId },
      });

      if (!existingEvent) {
        // Event was deleted between cluster and create - fall through to normal path
        log(`Matched event ${matchedEventId} not found, falling through to fingerprint path`);
      } else {
        log(`Adding SUPPORTING evidence to cluster-matched event ${matchedEventId}`);

        // Check for duplicate evidence link (idempotency)
        const existingEvidence = await tx.eventEvidence.findUnique({
          where: { eventId_snapshotId: { eventId: matchedEventId, snapshotId } },
        });

        if (!existingEvidence) {
          await tx.eventEvidence.create({
            data: {
              eventId: matchedEventId,
              snapshotId,
              role: "SUPPORTING",
            },
          });
        }

        return {
          eventId: matchedEventId,
          created: false,
          fingerprint: existingEvent.fingerprint,
        };
      }
    });
  }

  // Normal path: fingerprint-based dedup
  const fingerprint = generateFingerprint(title, occurredAt, sourceType);

  return prisma.$transaction(async (tx) => {
    // ... existing fingerprint logic unchanged ...
  });
}
```

Also update `processEventCreate` to pass `matchedEventId`:

```typescript
export async function processEventCreate(
  job: Job<EventCreateJob>
): Promise<EventCreateResult> {
  const { snapshotId, sourceType, sourceId, title, titleHr, occurredAt, impactLevel, matchedEventId } =
    job.data;

  log(`Processing event create for snapshot ${snapshotId}${matchedEventId ? ` (cluster-matched to ${matchedEventId})` : ""}`);

  const result = await createEvent({
    title,
    titleHr,
    occurredAt: new Date(occurredAt),
    sourceType: sourceType as SourceType,
    sourceId,
    snapshotId,
    impactLevel: impactLevel as ImpactLevel | undefined,
    matchedEventId,
  });

  log(
    `Event ${result.created ? "created" : "deduplicated"}: id=${result.eventId}, fingerprint=${result.fingerprint}`
  );

  return result;
}
```

**Step 2: Update worker index with new queues and workers**

In `apps/worker/src/index.ts`:

Add imports (after line 22):

```typescript
import { createEventClusterWorker } from "./processors/event-cluster";
import { createConfidenceScoreWorker } from "./processors/confidence-score";
import type { EventClusterJob, EventClusterResult } from "./processors/event-cluster";
import type { ConfidenceScoreJob, ConfidenceScoreResult } from "./processors/confidence-score";
```

Add queues (after line 60):

```typescript
  eventCluster: new Queue<EventClusterJob>("event-cluster", { connection }),
  confidenceScore: new Queue<ConfidenceScoreJob>("confidence-score", { connection }),
```

Rewire the pipeline:

Replace the `evidence-snapshot` completion handler (lines 108-122) to go to `event-cluster` instead of `event-create`:

```typescript
// 1. Evidence Snapshot Worker - on completion, enqueue event-CLUSTER (not event-create)
const evidenceSnapshotWorker = createEvidenceSnapshotWorker(connection);
evidenceSnapshotWorker.on("completed", async (job: Job<EvidenceSnapshotJob>, result: EvidenceSnapshotResult) => {
  if (!result?.snapshotId || !job.data.title) {
    log(`evidence-snapshot completed for ${job.data.url} but missing data, skipping`);
    return;
  }
  log(`evidence-snapshot completed for ${job.data.url}, enqueueing event-cluster`);
  await queues.eventCluster.add("cluster", {
    snapshotId: result.snapshotId,
    sourceType: job.data.sourceType,
    sourceId: job.data.sourceId,
    title: job.data.title,
    publishedAt: job.data.publishedAt || new Date().toISOString(),
  });
});
workers.push(evidenceSnapshotWorker);
```

Add new event-cluster worker (between evidence-snapshot and event-create):

```typescript
// 1.5. Event Cluster Worker - on completion, enqueue event-create with matchedEventId
const eventClusterWorker = createEventClusterWorker(connection);
eventClusterWorker.on("completed", async (_job: Job<EventClusterJob>, result: EventClusterResult) => {
  if (result.decision === "skipped") {
    log(`event-cluster skipped for ${result.snapshotId} (already linked)`);
    return;
  }
  log(`event-cluster ${result.decision} for ${result.snapshotId}, enqueueing event-create`);
  await queues.eventCreate.add("create", {
    snapshotId: result.snapshotId,
    sourceType: result.sourceType,
    sourceId: result.sourceId,
    title: result.title,
    occurredAt: result.publishedAt || new Date().toISOString(),
    matchedEventId: result.matchedEventId ?? undefined,
  });
});
workers.push(eventClusterWorker);
```

Replace event-create completion handler (lines 126-133) to go to `confidence-score`:

```typescript
// 2. Event Create Worker - on completion, enqueue confidence-score (NOT event-enrich directly)
const eventCreateWorker = createEventCreateWorker(connection);
eventCreateWorker.on("completed", async (_job: Job<EventCreateJob>, result: EventCreateResult) => {
  if (result && result.eventId) {
    log(`event-create completed for ${result.eventId}, enqueueing confidence-score`);
    await queues.confidenceScore.add("score", { eventId: result.eventId });
  }
});
workers.push(eventCreateWorker);
```

Add confidence-score worker (between event-create and event-enrich):

```typescript
// 2.5. Confidence Score Worker - on completion, enqueue event-enrich
const confidenceScoreWorker = createConfidenceScoreWorker(connection);
confidenceScoreWorker.on("completed", async (_job: Job<ConfidenceScoreJob>, result: ConfidenceScoreResult) => {
  if (result && result.eventId) {
    log(`confidence-score completed for ${result.eventId}: ${result.confidence}, enqueueing event-enrich`);
    await queues.eventEnrich.add("enrich", { eventId: result.eventId });
  }
});
workers.push(confidenceScoreWorker);
```

Update pipeline log (line 290):

```typescript
log("Pipeline: evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match");
```

**Step 3: Verify types compile**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/worker/src/
git commit -m "feat(worker): rewire pipeline with event-cluster and confidence-score processors"
```

---

## Task 7: tRPC + NormalizedEvent Updates

**Files:**
- Modify: `packages/shared/src/types/feeds.ts`
- Modify: `packages/trpc/src/routers/events.ts`

**Step 1: Add confidence to NormalizedEvent**

In `packages/shared/src/types/feeds.ts`, add to `NormalizedEventSchema` (line 53-69):

After `sourceCount: z.number(),` add:

```typescript
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().optional(),
```

**Step 2: Update toNormalizedEvent in events router**

In `packages/trpc/src/routers/events.ts`, update the `toNormalizedEvent` function (line 31-59):

After `sourceCount: event.evidence?.length || 1,` change to:

```typescript
    sourceCount: event.sourceCount ?? event.evidence?.length ?? 1,
    confidence: event.confidence ?? null,
```

**Step 3: Add confidence filter to list procedure**

In the list procedure input (line 64-72), add:

```typescript
        confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
```

And in the where clause (line 75-98), add:

```typescript
      if (input.confidence) {
        where.confidence = input.confidence;
      }
```

**Step 4: Verify types compile**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 5: Commit**

```bash
git add packages/shared/src/types/feeds.ts packages/trpc/src/routers/events.ts
git commit -m "feat(trpc): expose confidence level in events API"
```

---

## Task 8: UI Confidence Badge

**Files:**
- Modify: `apps/web/src/components/cockpit/cockpit-event-card.tsx`

The badge shows both a colored dot AND a text label (user adjustment #7).

**Step 1: Add confidence to CockpitEventCardProps**

In `apps/web/src/components/cockpit/cockpit-event-card.tsx`, update the interface (line 5-15):

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
}
```

**Step 2: Add confidence badge styling**

After `impactDot` (line 17-22), add:

```typescript
const confidenceBadge: Record<string, { dot: string; label: string; text: string }> = {
  HIGH: {
    dot: "bg-emerald-500",
    label: "HIGH",
    text: "text-emerald-400",
  },
  MEDIUM: {
    dot: "bg-amber-500",
    label: "MEDIUM",
    text: "text-amber-400",
  },
  LOW: {
    dot: "bg-red-500",
    label: "LOW",
    text: "text-red-400",
  },
};
```

**Step 3: Update component to accept and render confidence**

Update the destructured props (line 24-33):

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
}: CockpitEventCardProps) {
```

In the metadata row (line 60-67), after the sourceCount display, add the confidence badge:

```typescript
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="font-mono">{timeStr}</span>
              {sourceCount > 1 && (
                <>
                  <span>·</span>
                  <span>{sourceCount} izvora</span>
                </>
              )}
              {confidence && confidenceBadge[confidence] && (
                <>
                  <span>·</span>
                  <span className={`flex items-center gap-1 ${confidenceBadge[confidence].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${confidenceBadge[confidence].dot}`} />
                    {confidenceBadge[confidence].label}
                  </span>
                </>
              )}
            </div>
```

**Step 4: Update all places that render CockpitEventCard to pass confidence**

Check `apps/web/src/components/cockpit/source-section.tsx` and the observatory page to ensure they pass the `confidence` prop from the event data. Since `confidence` is optional, existing code will work without changes - the badge simply won't render for events without a confidence score yet.

**Step 5: Verify build**

```bash
cd /home/wandeon/GenAI2 && pnpm typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/components/cockpit/cockpit-event-card.tsx
git commit -m "feat(web): add confidence badge with text label to event cards"
```

---

## Verification

After implementing all 8 tasks:

1. **Database**
   ```bash
   cd /home/wandeon/GenAI2/packages/db && pnpm prisma migrate dev
   pnpm prisma generate
   ```

2. **Tests**
   ```bash
   cd /home/wandeon/GenAI2 && pnpm test
   ```

3. **Type check**
   ```bash
   pnpm typecheck
   ```

4. **Manual integration test**
   ```bash
   # Run a manual feed ingest on VPS
   docker exec genai2-worker-1 npx tsx /app/apps/worker/src/triggers/feed-ingest.ts
   ```

   Then check:
   - Events with multiple sources cluster into single events
   - `sourceCount` is correct (> 1 for clustered events)
   - Confidence levels are assigned (check DB directly)
   - QUARANTINED events exist for single LOW-source events
   - PUBLISHED events have HIGH or MEDIUM confidence
   - UI shows confidence badge with text label

5. **Gate criteria**
   - 3 articles about same OpenAI announcement → 1 Event with sourceCount=3 and confidence=HIGH
   - 1 Reddit post about obscure project → confidence=LOW, status=QUARANTINED
   - UI badge shows "HIGH" / "MEDIUM" / "LOW" text, not just color

---

## LLM Cost Estimate

| Component | Cost per call | Calls per ingest | Daily cost (4 ingests) |
|-----------|--------------|-----------------|----------------------|
| event-cluster (judge) | ~$0.005 | ~480 | ~$9.60 |
| **Pre-filter savings** | - | ~60% skip LLM | ~$3.84 |

**Mitigation strategies:**
- Bigram prefilter eliminates ~60% of snapshots (no candidates → no LLM call)
- Exact fingerprint match short-circuits before LLM
- MAX_CANDIDATES=10 caps prompt size
- LLM failure → safe default (new event), no retry

---

## Rollback Plan

If clustering produces bad results:
1. Set `TIME_WINDOW_HOURS = 0` in event-cluster.ts → all events become "new" (effectively disabling clustering)
2. Existing events are unaffected - confidence-score still works
3. No schema rollback needed - new fields are additive (nullable)
