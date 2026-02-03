# Phase 2: Event Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the automated event pipeline that transforms raw feed data into enriched, evidence-linked Events with GM-generated artifacts.

**Architecture:** BullMQ-based event-driven pipeline where each processor handles a single concern. Data flows: Feed → EvidenceSnapshot → Event → Enrich → Extract Entities → Extract Relationships → Assign Topics → Match Watchlists. Each step emits jobs for the next processor.

**Tech Stack:** BullMQ, Prisma, Zod, Google Gemini (via packages/llm), TypeScript

---

## Phase 2 Overview

| Sprint | Focus | Tasks |
|--------|-------|-------|
| 2.1 | Evidence Snapshot Processor | Capture URLs, create snapshots |
| 2.2 | Event Create Processor | Fingerprint dedup, status machine |
| 2.3 | Event Enrich Processor | GM artifacts (headline, summary, take) |
| 2.4 | Entity Extract Processor | Extract and link entities |
| 2.5 | Relationship Extract Processor | Extract relationships + safety gate |
| 2.6 | Topic Assign Processor | Assign topics based on content |
| 2.7 | Watchlist Match Processor | Match events to user watchlists |
| 2.8 | Queue Orchestration | Wire pipeline, add feed triggers |

---

## Prerequisites

Before starting, ensure:
1. Phase 1 migrations are applied: `pnpm db:migrate`
2. Redis is running: `docker compose up redis -d`
3. Environment variables set: `DATABASE_URL`, `REDIS_URL`, `GOOGLE_AI_API_KEY`

---

## Sprint 2.1: Evidence Snapshot Processor

**Goal:** Create immutable snapshots of source URLs with content hashing.

### Task 1: Create evidence snapshot processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/evidence-snapshot.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEvidenceSnapshot } from "../evidence-snapshot";
import { prisma } from "@genai/db";

// Mock Prisma
vi.mock("@genai/db", () => ({
  prisma: {
    evidenceSource: {
      upsert: vi.fn(),
    },
    evidenceSnapshot: {
      create: vi.fn(),
    },
  },
}));

describe("evidence-snapshot processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new EvidenceSource for new URL", async () => {
    const mockSource = { id: "src_1", canonicalUrl: "https://example.com/article" };
    const mockSnapshot = { id: "snap_1", sourceId: "src_1" };

    vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as any);
    vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue(mockSnapshot as any);

    const result = await createEvidenceSnapshot({
      rawUrl: "https://example.com/article?utm_source=twitter",
      title: "Test Article",
      content: "Article content here",
      author: "John Doe",
      publishedAt: new Date("2026-02-01"),
    });

    expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { canonicalUrl: "https://example.com/article" },
        create: expect.objectContaining({
          rawUrl: "https://example.com/article?utm_source=twitter",
          canonicalUrl: "https://example.com/article",
          domain: "example.com",
        }),
      })
    );
    expect(result.snapshotId).toBe("snap_1");
  });

  it("generates content hash for deduplication", async () => {
    const mockSource = { id: "src_1" };
    const mockSnapshot = { id: "snap_1", contentHash: expect.any(String) };

    vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue(mockSource as any);
    vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue(mockSnapshot as any);

    await createEvidenceSnapshot({
      rawUrl: "https://example.com/article",
      title: "Test",
      content: "Content",
    });

    expect(prisma.evidenceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
  });

  it("determines trust tier from domain", async () => {
    vi.mocked(prisma.evidenceSource.upsert).mockResolvedValue({ id: "src_1" } as any);
    vi.mocked(prisma.evidenceSnapshot.create).mockResolvedValue({ id: "snap_1" } as any);

    // Official source
    await createEvidenceSnapshot({
      rawUrl: "https://openai.com/blog/announcement",
      title: "OpenAI Announcement",
    });

    expect(prisma.evidenceSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          trustTier: "AUTHORITATIVE",
        }),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/worker && pnpm test src/processors/__tests__/evidence-snapshot.test.ts
```

Expected: FAIL (createEvidenceSnapshot not implemented)

---

### Task 2: Implement evidence snapshot processor

**Files:**
- Modify: `apps/worker/src/processors/evidence-snapshot.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { TrustTier } from "@prisma/client";
import crypto from "crypto";

// Authoritative domains (official company blogs/announcements)
const AUTHORITATIVE_DOMAINS = new Set([
  "openai.com",
  "anthropic.com",
  "deepmind.com",
  "ai.meta.com",
  "ai.google",
  "blog.google",
  "microsoft.com",
  "nvidia.com",
  "huggingface.co",
]);

// Low-trust domains (aggregators, social)
const LOW_TRUST_DOMAINS = new Set([
  "reddit.com",
  "twitter.com",
  "x.com",
  "news.ycombinator.com",
]);

export interface EvidenceSnapshotInput {
  rawUrl: string;
  title?: string;
  content?: string;
  author?: string;
  publishedAt?: Date;
  httpStatus?: number;
  headers?: Record<string, string>;
}

export interface EvidenceSnapshotResult {
  sourceId: string;
  snapshotId: string;
  isNewSource: boolean;
}

/**
 * Canonicalize URL by removing tracking parameters and normalizing
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    // Remove common tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"];
    trackingParams.forEach((param) => url.searchParams.delete(param));
    // Normalize to https
    url.protocol = "https:";
    // Remove trailing slash
    let canonical = url.toString();
    if (canonical.endsWith("/") && url.pathname !== "/") {
      canonical = canonical.slice(0, -1);
    }
    return canonical;
  } catch {
    return rawUrl;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Determine trust tier based on domain
 */
export function determineTrustTier(domain: string): TrustTier {
  if (AUTHORITATIVE_DOMAINS.has(domain)) {
    return "AUTHORITATIVE";
  }
  if (LOW_TRUST_DOMAINS.has(domain)) {
    return "LOW";
  }
  return "STANDARD";
}

/**
 * Generate SHA-256 hash of content
 */
export function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Create evidence snapshot from input data
 */
export async function createEvidenceSnapshot(
  input: EvidenceSnapshotInput
): Promise<EvidenceSnapshotResult> {
  const canonicalUrl = canonicalizeUrl(input.rawUrl);
  const domain = extractDomain(canonicalUrl);
  const trustTier = determineTrustTier(domain);
  const contentHash = generateContentHash(
    input.content || input.title || input.rawUrl
  );

  // Upsert source (create if not exists)
  const source = await prisma.evidenceSource.upsert({
    where: { canonicalUrl },
    create: {
      rawUrl: input.rawUrl,
      canonicalUrl,
      domain,
      trustTier,
    },
    update: {
      // Update rawUrl if it changed (e.g., different tracking params)
      rawUrl: input.rawUrl,
    },
  });

  // Create snapshot
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      sourceId: source.id,
      title: input.title,
      author: input.author,
      publishedAt: input.publishedAt,
      contentHash,
      fullText: input.content,
      httpStatus: input.httpStatus,
      headers: input.headers,
    },
  });

  return {
    sourceId: source.id,
    snapshotId: snapshot.id,
    isNewSource: source.createdAt.getTime() === snapshot.retrievedAt.getTime(),
  };
}

/**
 * BullMQ job processor for evidence snapshots
 */
export async function processEvidenceSnapshot(
  job: Job<EvidenceSnapshotInput>
): Promise<EvidenceSnapshotResult> {
  const result = await createEvidenceSnapshot(job.data);

  // Log for observability
  console.log(
    `[evidence-snapshot] Created snapshot ${result.snapshotId} for ${job.data.rawUrl}`
  );

  return result;
}

/**
 * Create the BullMQ worker
 */
export function createEvidenceSnapshotWorker(connection: any): Worker {
  return new Worker("evidence-snapshot", processEvidenceSnapshot, {
    connection,
    concurrency: 5,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/evidence-snapshot.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/evidence-snapshot.ts apps/worker/src/processors/__tests__/evidence-snapshot.test.ts
git commit -m "feat(worker): implement evidence-snapshot processor"
```

---

## Sprint 2.2: Event Create Processor

**Goal:** Create Events with fingerprint-based deduplication and status tracking.

### Task 3: Create event create processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/event-create.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEvent, generateFingerprint } from "../event-create";
import { prisma } from "@genai/db";

vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    eventEvidence: {
      create: vi.fn(),
    },
    eventStatusChange: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe("event-create processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateFingerprint", () => {
    it("generates consistent fingerprint for same inputs", () => {
      const fp1 = generateFingerprint("OpenAI releases GPT-5", new Date("2026-02-01"), "HN");
      const fp2 = generateFingerprint("OpenAI releases GPT-5", new Date("2026-02-01"), "HN");
      expect(fp1).toBe(fp2);
    });

    it("generates different fingerprint for different titles", () => {
      const fp1 = generateFingerprint("OpenAI releases GPT-5", new Date("2026-02-01"), "HN");
      const fp2 = generateFingerprint("Anthropic releases Claude 4", new Date("2026-02-01"), "HN");
      expect(fp1).not.toBe(fp2);
    });

    it("normalizes title case and whitespace", () => {
      const fp1 = generateFingerprint("OpenAI Releases GPT-5", new Date("2026-02-01"), "HN");
      const fp2 = generateFingerprint("  openai releases gpt-5  ", new Date("2026-02-01"), "HN");
      expect(fp1).toBe(fp2);
    });
  });

  describe("createEvent", () => {
    it("creates new event when fingerprint not found", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.event.create).mockResolvedValue({ id: "evt_1" } as any);
      vi.mocked(prisma.eventEvidence.create).mockResolvedValue({} as any);
      vi.mocked(prisma.eventStatusChange.create).mockResolvedValue({} as any);

      const result = await createEvent({
        title: "Test Event",
        occurredAt: new Date("2026-02-01"),
        sourceType: "HN",
        sourceId: "hn_123",
        snapshotId: "snap_1",
      });

      expect(result.created).toBe(true);
      expect(prisma.event.create).toHaveBeenCalled();
    });

    it("skips creation when fingerprint exists (dedup)", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt_existing" } as any);

      const result = await createEvent({
        title: "Test Event",
        occurredAt: new Date("2026-02-01"),
        sourceType: "HN",
        sourceId: "hn_123",
        snapshotId: "snap_1",
      });

      expect(result.created).toBe(false);
      expect(result.eventId).toBe("evt_existing");
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it("creates EventEvidence link", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.event.create).mockResolvedValue({ id: "evt_1" } as any);

      await createEvent({
        title: "Test Event",
        occurredAt: new Date("2026-02-01"),
        sourceType: "HN",
        sourceId: "hn_123",
        snapshotId: "snap_1",
      });

      expect(prisma.eventEvidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: "evt_1",
            snapshotId: "snap_1",
            role: "PRIMARY",
          }),
        })
      );
    });

    it("creates initial status change to RAW", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.event.create).mockResolvedValue({ id: "evt_1" } as any);

      await createEvent({
        title: "Test Event",
        occurredAt: new Date("2026-02-01"),
        sourceType: "HN",
        sourceId: "hn_123",
        snapshotId: "snap_1",
      });

      expect(prisma.eventStatusChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: "evt_1",
            fromStatus: null,
            toStatus: "RAW",
            reason: "Initial creation from HN",
          }),
        })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/worker && pnpm test src/processors/__tests__/event-create.test.ts
```

Expected: FAIL

---

### Task 4: Implement event create processor

**Files:**
- Modify: `apps/worker/src/processors/event-create.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { SourceType, ImpactLevel, EvidenceRole } from "@prisma/client";
import crypto from "crypto";

export interface EventCreateInput {
  title: string;
  titleHr?: string;
  occurredAt: Date;
  sourceType: SourceType;
  sourceId: string;
  snapshotId: string;
  impactLevel?: ImpactLevel;
}

export interface EventCreateResult {
  eventId: string;
  created: boolean;
  fingerprint: string;
}

/**
 * Generate fingerprint for event deduplication
 * Format: SHA-256 of "sourceType:YYYY-MM-DD:normalizedTitle"
 */
export function generateFingerprint(
  title: string,
  occurredAt: Date,
  sourceType: string
): string {
  const normalized = title.toLowerCase().trim().replace(/\s+/g, " ");
  const dateStr = occurredAt.toISOString().split("T")[0];
  const input = `${sourceType}:${dateStr}:${normalized}`;
  return crypto.createHash("sha256").update(input).digest("hex").substring(0, 32);
}

/**
 * Create event with fingerprint-based deduplication
 */
export async function createEvent(
  input: EventCreateInput
): Promise<EventCreateResult> {
  const fingerprint = generateFingerprint(
    input.title,
    input.occurredAt,
    input.sourceType
  );

  // Check for existing event with same fingerprint
  const existing = await prisma.event.findUnique({
    where: { fingerprint },
    select: { id: true },
  });

  if (existing) {
    // Dedup: add supporting evidence to existing event
    await prisma.eventEvidence.upsert({
      where: {
        eventId_snapshotId: {
          eventId: existing.id,
          snapshotId: input.snapshotId,
        },
      },
      create: {
        eventId: existing.id,
        snapshotId: input.snapshotId,
        role: "SUPPORTING" as EvidenceRole,
      },
      update: {},
    });

    return {
      eventId: existing.id,
      created: false,
      fingerprint,
    };
  }

  // Create new event with evidence link and status change
  const event = await prisma.$transaction(async (tx) => {
    const newEvent = await tx.event.create({
      data: {
        fingerprint,
        title: input.title,
        titleHr: input.titleHr,
        occurredAt: input.occurredAt,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        impactLevel: input.impactLevel || "MEDIUM",
        status: "RAW",
      },
    });

    // Link primary evidence
    await tx.eventEvidence.create({
      data: {
        eventId: newEvent.id,
        snapshotId: input.snapshotId,
        role: "PRIMARY" as EvidenceRole,
      },
    });

    // Create initial status change
    await tx.eventStatusChange.create({
      data: {
        eventId: newEvent.id,
        fromStatus: null,
        toStatus: "RAW",
        reason: `Initial creation from ${input.sourceType}`,
        changedBy: "event-create-processor",
      },
    });

    return newEvent;
  });

  return {
    eventId: event.id,
    created: true,
    fingerprint,
  };
}

/**
 * BullMQ job processor
 */
export async function processEventCreate(
  job: Job<EventCreateInput>
): Promise<EventCreateResult> {
  const result = await createEvent(job.data);

  console.log(
    `[event-create] ${result.created ? "Created" : "Deduped"} event ${result.eventId} (fp: ${result.fingerprint.substring(0, 8)}...)`
  );

  return result;
}

/**
 * Create the BullMQ worker
 */
export function createEventCreateWorker(connection: any): Worker {
  return new Worker("event-create", processEventCreate, {
    connection,
    concurrency: 5,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/event-create.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/event-create.ts apps/worker/src/processors/__tests__/event-create.test.ts
git commit -m "feat(worker): implement event-create processor with fingerprint dedup"
```

---

## Sprint 2.3: Event Enrich Processor

**Goal:** Enrich events with GM-generated artifacts (headline, summary, GM take).

### Task 5: Set up LLM client for Gemini

**Files:**
- Modify: `packages/llm/src/clients/gemini.ts`

**Step 1: Implement Gemini client**

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface LLMClient {
  provider: string;
  model: string;
  complete(prompt: string): Promise<LLMResponse>;
}

export interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export function createGeminiClient(apiKey: string, model = "gemini-2.0-flash"): LLMClient {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  return {
    provider: "google",
    model,
    async complete(prompt: string): Promise<LLMResponse> {
      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Get token counts from usage metadata
      const usage = response.usageMetadata;

      return {
        content: text,
        usage: {
          inputTokens: usage?.promptTokenCount || 0,
          outputTokens: usage?.candidatesTokenCount || 0,
          totalTokens: usage?.totalTokenCount || 0,
        },
      };
    },
  };
}
```

**Step 2: Commit**

```bash
git add packages/llm/src/clients/gemini.ts
git commit -m "feat(llm): implement Gemini client"
```

---

### Task 6: Create event enrich processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/event-enrich.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrichEvent } from "../event-enrich";
import { prisma } from "@genai/db";

vi.mock("@genai/db", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    eventArtifact: {
      create: vi.fn(),
    },
    eventStatusChange: {
      create: vi.fn(),
    },
    llmRun: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@genai/llm", () => ({
  createGeminiClient: vi.fn(() => ({
    provider: "google",
    model: "gemini-2.0-flash",
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        en: "Test headline",
        hr: "Testni naslov",
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }),
  })),
}));

describe("event-enrich processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates HEADLINE artifact", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI announces GPT-5",
      status: "RAW",
      evidence: [{ snapshot: { fullText: "Full article content" } }],
    } as any);

    await enrichEvent({ eventId: "evt_1" });

    expect(prisma.eventArtifact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "evt_1",
          artifactType: "HEADLINE",
          payload: expect.objectContaining({
            en: expect.any(String),
            hr: expect.any(String),
          }),
        }),
      })
    );
  });

  it("transitions event status to ENRICHED", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      status: "RAW",
      evidence: [],
    } as any);

    await enrichEvent({ eventId: "evt_1" });

    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt_1" },
        data: { status: "ENRICHED" },
      })
    );

    expect(prisma.eventStatusChange.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: "evt_1",
          fromStatus: "RAW",
          toStatus: "ENRICHED",
        }),
      })
    );
  });

  it("logs LLM run for cost tracking", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      status: "RAW",
      evidence: [],
    } as any);

    await enrichEvent({ eventId: "evt_1" });

    expect(prisma.llmRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "google",
          model: "gemini-2.0-flash",
          inputTokens: expect.any(Number),
          outputTokens: expect.any(Number),
          processorName: "event-enrich",
          eventId: "evt_1",
        }),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/worker && pnpm test src/processors/__tests__/event-enrich.test.ts
```

Expected: FAIL

---

### Task 7: Implement event enrich processor

**Files:**
- Modify: `apps/worker/src/processors/event-enrich.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { ArtifactType, EventStatus } from "@prisma/client";
import { createGeminiClient, LLMClient } from "@genai/llm";
import {
  HeadlinePayload,
  SummaryPayload,
  GMTakePayload,
} from "@genai/shared";
import crypto from "crypto";

export interface EventEnrichInput {
  eventId: string;
}

export interface EventEnrichResult {
  eventId: string;
  artifactsCreated: ArtifactType[];
  totalTokens: number;
  costCents: number;
}

// Cost per 1M tokens (Gemini 2.0 Flash pricing)
const COST_PER_MILLION_INPUT = 0.075; // $0.075 per 1M input tokens
const COST_PER_MILLION_OUTPUT = 0.30; // $0.30 per 1M output tokens

function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT * 100;
  const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT * 100;
  return Math.ceil(inputCost + outputCost);
}

function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

async function generateArtifact(
  client: LLMClient,
  eventId: string,
  artifactType: ArtifactType,
  prompt: string,
  inputData: string,
  runId: string
): Promise<{ payload: unknown; tokens: number; costCents: number }> {
  const promptHash = hashString(prompt);
  const inputHash = hashString(inputData);
  const startTime = Date.now();

  const response = await client.complete(prompt);
  const latencyMs = Date.now() - startTime;

  // Parse and validate response
  let payload: unknown;
  try {
    payload = JSON.parse(response.content);
  } catch {
    // If not valid JSON, wrap in appropriate structure
    payload = { en: response.content, hr: response.content };
  }

  // Log LLM run
  await prisma.llmRun.create({
    data: {
      id: runId,
      provider: client.provider,
      model: client.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      costCents: calculateCostCents(response.usage.inputTokens, response.usage.outputTokens),
      latencyMs,
      promptHash,
      inputHash,
      processorName: "event-enrich",
      eventId,
    },
  });

  // Create artifact
  await prisma.eventArtifact.create({
    data: {
      eventId,
      artifactType,
      payload: payload as any,
      modelUsed: client.model,
      promptVersion: "v1",
      promptHash,
      inputHash,
      runId,
    },
  });

  return {
    payload,
    tokens: response.usage.totalTokens,
    costCents: calculateCostCents(response.usage.inputTokens, response.usage.outputTokens),
  };
}

export async function enrichEvent(
  input: EventEnrichInput,
  client?: LLMClient
): Promise<EventEnrichResult> {
  // Get event with evidence
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      evidence: {
        include: { snapshot: true },
        where: { role: "PRIMARY" },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`);
  }

  if (event.status !== "RAW") {
    console.log(`[event-enrich] Skipping ${input.eventId} - status is ${event.status}`);
    return {
      eventId: input.eventId,
      artifactsCreated: [],
      totalTokens: 0,
      costCents: 0,
    };
  }

  // Initialize LLM client
  const llm = client || createGeminiClient(process.env.GOOGLE_AI_API_KEY!);

  // Gather context from evidence
  const context = event.evidence
    .map((e) => e.snapshot.fullText || e.snapshot.title || "")
    .join("\n\n");

  const artifactsCreated: ArtifactType[] = [];
  let totalTokens = 0;
  let totalCostCents = 0;

  // Generate HEADLINE
  const headlinePrompt = `You are GM, an AI news curator for Croatian audience. Generate a headline for this event.

Event title: ${event.title}
Context: ${context.substring(0, 2000)}

Respond with JSON: {"en": "English headline", "hr": "Croatian headline"}
Keep it concise (max 100 chars). Be informative, not sensational.`;

  const headlineResult = await generateArtifact(
    llm,
    event.id,
    "HEADLINE",
    headlinePrompt,
    context,
    crypto.randomUUID()
  );
  artifactsCreated.push("HEADLINE");
  totalTokens += headlineResult.tokens;
  totalCostCents += headlineResult.costCents;

  // Generate SUMMARY
  const summaryPrompt = `You are GM, an AI news curator for Croatian audience. Generate a summary for this event.

Event title: ${event.title}
Context: ${context.substring(0, 4000)}

Respond with JSON:
{
  "en": "English summary (2-3 sentences)",
  "hr": "Croatian summary (2-3 sentences)",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"]
}

Be factual. Link claims to evidence. No hype.`;

  const summaryResult = await generateArtifact(
    llm,
    event.id,
    "SUMMARY",
    summaryPrompt,
    context,
    crypto.randomUUID()
  );
  artifactsCreated.push("SUMMARY");
  totalTokens += summaryResult.tokens;
  totalCostCents += summaryResult.costCents;

  // Generate GM_TAKE
  const takePrompt = `You are GM, an AI news curator for Croatian audience. Give your take on this event.

Event title: ${event.title}
Context: ${context.substring(0, 4000)}

Respond with JSON:
{
  "take": "Your analysis in English (1-2 sentences)",
  "takeHr": "Your analysis in Croatian (1-2 sentences)",
  "confidence": "low" | "medium" | "high",
  "caveats": ["Any important caveats"]
}

Be honest about uncertainty. No fake certainty. If sources conflict, say so.`;

  const takeResult = await generateArtifact(
    llm,
    event.id,
    "GM_TAKE",
    takePrompt,
    context,
    crypto.randomUUID()
  );
  artifactsCreated.push("GM_TAKE");
  totalTokens += takeResult.tokens;
  totalCostCents += takeResult.costCents;

  // Update event status to ENRICHED
  await prisma.$transaction([
    prisma.event.update({
      where: { id: event.id },
      data: { status: "ENRICHED" },
    }),
    prisma.eventStatusChange.create({
      data: {
        eventId: event.id,
        fromStatus: "RAW",
        toStatus: "ENRICHED",
        reason: `Generated ${artifactsCreated.length} artifacts`,
        changedBy: "event-enrich-processor",
      },
    }),
  ]);

  return {
    eventId: event.id,
    artifactsCreated,
    totalTokens,
    costCents: totalCostCents,
  };
}

export async function processEventEnrich(
  job: Job<EventEnrichInput>
): Promise<EventEnrichResult> {
  const result = await enrichEvent(job.data);

  console.log(
    `[event-enrich] Enriched ${result.eventId} with ${result.artifactsCreated.length} artifacts (${result.totalTokens} tokens, $${(result.costCents / 100).toFixed(4)})`
  );

  return result;
}

export function createEventEnrichWorker(connection: any): Worker {
  return new Worker("event-enrich", processEventEnrich, {
    connection,
    concurrency: 2, // Lower concurrency for LLM calls
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/event-enrich.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/event-enrich.ts apps/worker/src/processors/__tests__/event-enrich.test.ts
git commit -m "feat(worker): implement event-enrich processor with GM artifacts"
```

---

## Sprint 2.4: Entity Extract Processor

**Goal:** Extract entities from events and create/link them in the database.

### Task 8: Create entity extract processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/entity-extract.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractEntities } from "../entity-extract";
import { prisma } from "@genai/db";

vi.mock("@genai/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    entity: { upsert: vi.fn() },
    entityMention: { upsert: vi.fn() },
    eventArtifact: { create: vi.fn() },
    llmRun: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@genai/llm", () => ({
  createGeminiClient: vi.fn(() => ({
    provider: "google",
    model: "gemini-2.0-flash",
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        entities: [
          { name: "OpenAI", type: "COMPANY", role: "SUBJECT", confidence: 0.95 },
          { name: "GPT-5", type: "MODEL", role: "OBJECT", confidence: 0.9 },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }),
  })),
}));

describe("entity-extract processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts entities from event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI announces GPT-5",
      artifacts: [{ artifactType: "SUMMARY", payload: { en: "Summary" } }],
    } as any);
    vi.mocked(prisma.entity.upsert).mockResolvedValue({ id: "ent_1" } as any);

    const result = await extractEntities({ eventId: "evt_1" });

    expect(result.entitiesExtracted).toBe(2);
    expect(prisma.entity.upsert).toHaveBeenCalledTimes(2);
  });

  it("creates entity mentions with roles", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      artifacts: [],
    } as any);
    vi.mocked(prisma.entity.upsert).mockResolvedValue({ id: "ent_1" } as any);

    await extractEntities({ eventId: "evt_1" });

    expect(prisma.entityMention.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          eventId: "evt_1",
          role: expect.stringMatching(/^(SUBJECT|OBJECT|MENTIONED)$/),
          confidence: expect.any(Number),
        }),
      })
    );
  });

  it("generates slug from entity name", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      artifacts: [],
    } as any);

    await extractEntities({ eventId: "evt_1" });

    expect(prisma.entity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "openai" },
        create: expect.objectContaining({
          name: "OpenAI",
          slug: "openai",
        }),
      })
    );
  });
});
```

**Step 2: Run test**

```bash
cd apps/worker && pnpm test src/processors/__tests__/entity-extract.test.ts
```

Expected: FAIL

---

### Task 9: Implement entity extract processor

**Files:**
- Modify: `apps/worker/src/processors/entity-extract.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { EntityType, MentionRole } from "@prisma/client";
import { createGeminiClient, LLMClient } from "@genai/llm";
import { EntityExtractPayload } from "@genai/shared";
import crypto from "crypto";

export interface EntityExtractInput {
  eventId: string;
}

export interface EntityExtractResult {
  eventId: string;
  entitiesExtracted: number;
  entitiesCreated: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

export async function extractEntities(
  input: EntityExtractInput,
  client?: LLMClient
): Promise<EntityExtractResult> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      artifacts: {
        where: { artifactType: { in: ["HEADLINE", "SUMMARY"] } },
      },
      evidence: {
        include: { snapshot: true },
        where: { role: "PRIMARY" },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`);
  }

  const llm = client || createGeminiClient(process.env.GOOGLE_AI_API_KEY!);

  // Build context from artifacts and evidence
  const context = [
    `Title: ${event.title}`,
    ...event.artifacts.map((a) => JSON.stringify(a.payload)),
    ...event.evidence.map((e) => e.snapshot.fullText || "").filter(Boolean),
  ].join("\n\n");

  const prompt = `Extract entities from this AI news event. Return JSON with entities array.

${context.substring(0, 4000)}

Types: COMPANY, LAB, MODEL, PRODUCT, PERSON, REGULATION, DATASET, BENCHMARK
Roles: SUBJECT (main actor), OBJECT (acted upon), MENTIONED (referenced)

Respond ONLY with JSON:
{
  "entities": [
    {"name": "Entity Name", "type": "COMPANY", "role": "SUBJECT", "confidence": 0.95}
  ]
}`;

  const promptHash = hashString(prompt);
  const inputHash = hashString(context);
  const startTime = Date.now();

  const response = await llm.complete(prompt);
  const latencyMs = Date.now() - startTime;

  // Log LLM run
  const runId = crypto.randomUUID();
  await prisma.llmRun.create({
    data: {
      id: runId,
      provider: llm.provider,
      model: llm.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      costCents: Math.ceil((response.usage.totalTokens / 1_000_000) * 37.5),
      latencyMs,
      promptHash,
      inputHash,
      processorName: "entity-extract",
      eventId: input.eventId,
    },
  });

  // Parse response
  let payload: EntityExtractPayload;
  try {
    payload = JSON.parse(response.content);
  } catch {
    payload = { entities: [] };
  }

  // Create artifact
  await prisma.eventArtifact.create({
    data: {
      eventId: input.eventId,
      artifactType: "ENTITY_EXTRACT",
      payload: payload as any,
      modelUsed: llm.model,
      promptVersion: "v1",
      promptHash,
      inputHash,
      runId,
    },
  });

  // Upsert entities and create mentions
  let entitiesCreated = 0;
  for (const entity of payload.entities) {
    const slug = slugify(entity.name);

    const dbEntity = await prisma.entity.upsert({
      where: { slug },
      create: {
        name: entity.name,
        slug,
        type: entity.type as EntityType,
        firstSeen: event.occurredAt,
        lastSeen: event.occurredAt,
      },
      update: {
        lastSeen: event.occurredAt,
      },
    });

    // Track if this was a new entity
    if (dbEntity.firstSeen.getTime() === dbEntity.lastSeen.getTime()) {
      entitiesCreated++;
    }

    // Create mention
    await prisma.entityMention.upsert({
      where: {
        eventId_entityId: {
          eventId: input.eventId,
          entityId: dbEntity.id,
        },
      },
      create: {
        eventId: input.eventId,
        entityId: dbEntity.id,
        role: entity.role as MentionRole,
        confidence: entity.confidence,
      },
      update: {
        role: entity.role as MentionRole,
        confidence: entity.confidence,
      },
    });
  }

  return {
    eventId: input.eventId,
    entitiesExtracted: payload.entities.length,
    entitiesCreated,
  };
}

export async function processEntityExtract(
  job: Job<EntityExtractInput>
): Promise<EntityExtractResult> {
  const result = await extractEntities(job.data);

  console.log(
    `[entity-extract] Extracted ${result.entitiesExtracted} entities (${result.entitiesCreated} new) for ${result.eventId}`
  );

  return result;
}

export function createEntityExtractWorker(connection: any): Worker {
  return new Worker("entity-extract", processEntityExtract, {
    connection,
    concurrency: 2,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/entity-extract.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/entity-extract.ts apps/worker/src/processors/__tests__/entity-extract.test.ts
git commit -m "feat(worker): implement entity-extract processor"
```

---

## Sprint 2.5: Relationship Extract Processor

**Goal:** Extract relationships between entities and validate with safety gate.

### Task 10: Create relationship extract processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/relationship-extract.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { extractRelationships } from "../relationship-extract";
import { prisma } from "@genai/db";
import { validateRelationship } from "@genai/shared";

vi.mock("@genai/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    entity: { findUnique: vi.fn() },
    relationship: { create: vi.fn() },
    llmRun: { create: vi.fn() },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock("@genai/shared", async () => {
  const actual = await vi.importActual("@genai/shared");
  return {
    ...actual,
    validateRelationship: vi.fn(),
  };
});

vi.mock("@genai/llm", () => ({
  createGeminiClient: vi.fn(() => ({
    provider: "google",
    model: "gemini-2.0-flash",
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        relationships: [
          { source: "OpenAI", target: "GPT-5", type: "RELEASED", confidence: 0.95 },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }),
  })),
}));

describe("relationship-extract processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts relationships between entities", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI releases GPT-5",
      occurredAt: new Date(),
      mentions: [
        { entity: { id: "ent_1", name: "OpenAI", slug: "openai" } },
        { entity: { id: "ent_2", name: "GPT-5", slug: "gpt-5" } },
      ],
      evidence: [{ snapshot: { source: { trustTier: "STANDARD" } } }],
    } as any);
    vi.mocked(prisma.entity.findUnique).mockImplementation(({ where }) => {
      if (where.slug === "openai") return Promise.resolve({ id: "ent_1" } as any);
      if (where.slug === "gpt-5") return Promise.resolve({ id: "ent_2" } as any);
      return Promise.resolve(null);
    });
    vi.mocked(validateRelationship).mockReturnValue({ status: "APPROVED", reason: "Low risk" });

    const result = await extractRelationships({ eventId: "evt_1" });

    expect(result.relationshipsExtracted).toBe(1);
    expect(prisma.relationship.create).toHaveBeenCalled();
  });

  it("applies safety gate to relationships", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Company A acquires Company B",
      occurredAt: new Date(),
      mentions: [
        { entity: { id: "ent_1", name: "Company A", slug: "company-a" } },
        { entity: { id: "ent_2", name: "Company B", slug: "company-b" } },
      ],
      evidence: [{ snapshot: { source: { trustTier: "LOW" } } }],
    } as any);
    vi.mocked(prisma.entity.findUnique).mockResolvedValue({ id: "ent_1" } as any);
    vi.mocked(validateRelationship).mockReturnValue({
      status: "QUARANTINED",
      reason: "High risk needs authoritative source",
    });

    await extractRelationships({ eventId: "evt_1" });

    expect(prisma.relationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "QUARANTINED",
          statusReason: "High risk needs authoritative source",
        }),
      })
    );
  });
});
```

**Step 2: Run test**

```bash
cd apps/worker && pnpm test src/processors/__tests__/relationship-extract.test.ts
```

Expected: FAIL

---

### Task 11: Implement relationship extract processor

**Files:**
- Modify: `apps/worker/src/processors/relationship-extract.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { RelationType, RelationshipStatus } from "@prisma/client";
import { createGeminiClient, LLMClient } from "@genai/llm";
import { validateRelationship, TrustTier } from "@genai/shared";
import crypto from "crypto";

export interface RelationshipExtractInput {
  eventId: string;
}

export interface RelationshipExtractResult {
  eventId: string;
  relationshipsExtracted: number;
  approved: number;
  quarantined: number;
}

interface ExtractedRelationship {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function extractRelationships(
  input: RelationshipExtractInput,
  client?: LLMClient
): Promise<RelationshipExtractResult> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      mentions: { include: { entity: true } },
      evidence: {
        include: { snapshot: { include: { source: true } } },
        where: { role: "PRIMARY" },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`);
  }

  if (event.mentions.length < 2) {
    return {
      eventId: input.eventId,
      relationshipsExtracted: 0,
      approved: 0,
      quarantined: 0,
    };
  }

  const llm = client || createGeminiClient(process.env.GOOGLE_AI_API_KEY!);
  const entityNames = event.mentions.map((m) => m.entity.name);

  const prompt = `Extract relationships between these entities based on the event.

Event: ${event.title}
Entities: ${entityNames.join(", ")}

Relationship types:
- RELEASED (company released product/model)
- ANNOUNCED (official announcement)
- PUBLISHED (paper published)
- PARTNERED (partnership)
- INTEGRATED (integration)
- FUNDED (funding)
- ACQUIRED (acquisition)
- BANNED (regulatory action)
- BEATS (benchmark comparison)
- CRITICIZED (public criticism)

Respond ONLY with JSON:
{
  "relationships": [
    {"source": "Entity A", "target": "Entity B", "type": "RELEASED", "confidence": 0.9}
  ]
}

Only include relationships clearly stated in the event. Do not infer.`;

  const response = await llm.complete(prompt);

  // Log LLM run
  const runId = crypto.randomUUID();
  await prisma.llmRun.create({
    data: {
      id: runId,
      provider: llm.provider,
      model: llm.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      costCents: Math.ceil((response.usage.totalTokens / 1_000_000) * 37.5),
      latencyMs: 0,
      promptHash: crypto.createHash("sha256").update(prompt).digest("hex"),
      inputHash: crypto.createHash("sha256").update(event.title).digest("hex"),
      processorName: "relationship-extract",
      eventId: input.eventId,
    },
  });

  let relationships: ExtractedRelationship[] = [];
  try {
    const parsed = JSON.parse(response.content);
    relationships = parsed.relationships || [];
  } catch {
    relationships = [];
  }

  // Get trust tier and source count for safety gate
  const trustTier = (event.evidence[0]?.snapshot.source.trustTier || "STANDARD") as TrustTier;
  const sourceCount = event.evidence.length;

  let approved = 0;
  let quarantined = 0;

  for (const rel of relationships) {
    const sourceSlug = slugify(rel.source);
    const targetSlug = slugify(rel.target);

    const sourceEntity = await prisma.entity.findUnique({ where: { slug: sourceSlug } });
    const targetEntity = await prisma.entity.findUnique({ where: { slug: targetSlug } });

    if (!sourceEntity || !targetEntity) {
      continue;
    }

    // Apply safety gate
    const safetyResult = validateRelationship(
      {
        sourceEntity: sourceEntity.name,
        targetEntity: targetEntity.name,
        type: rel.type as RelationType,
        eventId: input.eventId,
        modelConfidence: rel.confidence,
      },
      trustTier,
      sourceCount
    );

    await prisma.relationship.create({
      data: {
        sourceId: sourceEntity.id,
        targetId: targetEntity.id,
        type: rel.type as RelationType,
        eventId: input.eventId,
        status: safetyResult.status as RelationshipStatus,
        statusReason: safetyResult.reason,
        modelConfidence: rel.confidence,
        occurredAt: event.occurredAt,
      },
    });

    if (safetyResult.status === "APPROVED") {
      approved++;
    } else {
      quarantined++;
    }
  }

  return {
    eventId: input.eventId,
    relationshipsExtracted: relationships.length,
    approved,
    quarantined,
  };
}

export async function processRelationshipExtract(
  job: Job<RelationshipExtractInput>
): Promise<RelationshipExtractResult> {
  const result = await extractRelationships(job.data);

  console.log(
    `[relationship-extract] Extracted ${result.relationshipsExtracted} relationships (${result.approved} approved, ${result.quarantined} quarantined) for ${result.eventId}`
  );

  return result;
}

export function createRelationshipExtractWorker(connection: any): Worker {
  return new Worker("relationship-extract", processRelationshipExtract, {
    connection,
    concurrency: 2,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/relationship-extract.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/relationship-extract.ts apps/worker/src/processors/__tests__/relationship-extract.test.ts
git commit -m "feat(worker): implement relationship-extract processor with safety gate"
```

---

## Sprint 2.6: Topic Assign Processor

**Goal:** Assign topics to events based on content analysis.

### Task 12: Create topic assign processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/topic-assign.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { assignTopics } from "../topic-assign";
import { prisma } from "@genai/db";

vi.mock("@genai/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    topic: { findMany: vi.fn(), findUnique: vi.fn() },
    eventTopic: { upsert: vi.fn() },
    eventArtifact: { create: vi.fn() },
    llmRun: { create: vi.fn() },
  },
}));

vi.mock("@genai/llm", () => ({
  createGeminiClient: vi.fn(() => ({
    provider: "google",
    model: "gemini-2.0-flash",
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        topics: [
          { slug: "llm", confidence: 0.95 },
          { slug: "products", confidence: 0.8 },
        ],
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }),
  })),
}));

describe("topic-assign processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns topics to event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI releases GPT-5",
      artifacts: [{ artifactType: "SUMMARY", payload: { en: "Summary" } }],
    } as any);
    vi.mocked(prisma.topic.findMany).mockResolvedValue([
      { id: "topic_1", slug: "llm", name: "LLM" },
      { id: "topic_2", slug: "products", name: "Products" },
    ] as any);
    vi.mocked(prisma.topic.findUnique).mockImplementation(({ where }) => {
      if (where.slug === "llm") return Promise.resolve({ id: "topic_1" } as any);
      if (where.slug === "products") return Promise.resolve({ id: "topic_2" } as any);
      return Promise.resolve(null);
    });

    const result = await assignTopics({ eventId: "evt_1" });

    expect(result.topicsAssigned).toBe(2);
    expect(prisma.eventTopic.upsert).toHaveBeenCalledTimes(2);
  });

  it("uses LLM origin for assigned topics", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      artifacts: [],
    } as any);
    vi.mocked(prisma.topic.findMany).mockResolvedValue([{ slug: "llm" }] as any);
    vi.mocked(prisma.topic.findUnique).mockResolvedValue({ id: "topic_1" } as any);

    await assignTopics({ eventId: "evt_1" });

    expect(prisma.eventTopic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          origin: "LLM",
        }),
      })
    );
  });
});
```

**Step 2: Run test**

```bash
cd apps/worker && pnpm test src/processors/__tests__/topic-assign.test.ts
```

Expected: FAIL

---

### Task 13: Implement topic assign processor

**Files:**
- Modify: `apps/worker/src/processors/topic-assign.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";
import { createGeminiClient, LLMClient } from "@genai/llm";
import { TopicAssignPayload } from "@genai/shared";
import crypto from "crypto";

export interface TopicAssignInput {
  eventId: string;
}

export interface TopicAssignResult {
  eventId: string;
  topicsAssigned: number;
}

export async function assignTopics(
  input: TopicAssignInput,
  client?: LLMClient
): Promise<TopicAssignResult> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      artifacts: {
        where: { artifactType: { in: ["HEADLINE", "SUMMARY", "GM_TAKE"] } },
      },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`);
  }

  // Get available topics
  const topics = await prisma.topic.findMany({
    select: { slug: true, name: true, nameHr: true },
  });

  const llm = client || createGeminiClient(process.env.GOOGLE_AI_API_KEY!);

  const context = [
    `Title: ${event.title}`,
    ...event.artifacts.map((a) => JSON.stringify(a.payload)),
  ].join("\n");

  const topicList = topics.map((t) => `- ${t.slug}: ${t.name}`).join("\n");

  const prompt = `Assign topics to this AI news event.

${context.substring(0, 2000)}

Available topics:
${topicList}

Respond ONLY with JSON:
{
  "topics": [
    {"slug": "topic-slug", "confidence": 0.9}
  ]
}

Assign 1-3 most relevant topics. Only use slugs from the list above.`;

  const response = await llm.complete(prompt);

  // Log LLM run
  const runId = crypto.randomUUID();
  await prisma.llmRun.create({
    data: {
      id: runId,
      provider: llm.provider,
      model: llm.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      totalTokens: response.usage.totalTokens,
      costCents: Math.ceil((response.usage.totalTokens / 1_000_000) * 37.5),
      latencyMs: 0,
      promptHash: crypto.createHash("sha256").update(prompt).digest("hex"),
      inputHash: crypto.createHash("sha256").update(context).digest("hex"),
      processorName: "topic-assign",
      eventId: input.eventId,
    },
  });

  let payload: TopicAssignPayload;
  try {
    payload = JSON.parse(response.content);
  } catch {
    payload = { topics: [] };
  }

  // Create artifact
  await prisma.eventArtifact.create({
    data: {
      eventId: input.eventId,
      artifactType: "TOPIC_ASSIGN",
      payload: payload as any,
      modelUsed: llm.model,
      promptVersion: "v1",
      promptHash: crypto.createHash("sha256").update(prompt).digest("hex"),
      inputHash: crypto.createHash("sha256").update(context).digest("hex"),
      runId,
    },
  });

  // Create EventTopic links
  let assigned = 0;
  for (const topicAssignment of payload.topics) {
    const topic = await prisma.topic.findUnique({
      where: { slug: topicAssignment.slug },
    });

    if (!topic) continue;

    await prisma.eventTopic.upsert({
      where: {
        eventId_topicId: {
          eventId: input.eventId,
          topicId: topic.id,
        },
      },
      create: {
        eventId: input.eventId,
        topicId: topic.id,
        confidence: topicAssignment.confidence,
        origin: "LLM",
      },
      update: {
        confidence: topicAssignment.confidence,
      },
    });
    assigned++;
  }

  return {
    eventId: input.eventId,
    topicsAssigned: assigned,
  };
}

export async function processTopicAssign(
  job: Job<TopicAssignInput>
): Promise<TopicAssignResult> {
  const result = await assignTopics(job.data);

  console.log(
    `[topic-assign] Assigned ${result.topicsAssigned} topics to ${result.eventId}`
  );

  return result;
}

export function createTopicAssignWorker(connection: any): Worker {
  return new Worker("topic-assign", processTopicAssign, {
    connection,
    concurrency: 2,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/topic-assign.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/topic-assign.ts apps/worker/src/processors/__tests__/topic-assign.test.ts
git commit -m "feat(worker): implement topic-assign processor"
```

---

## Sprint 2.7: Watchlist Match Processor

**Goal:** Match events to user watchlists and create notifications.

### Task 14: Create watchlist match processor tests

**Files:**
- Create: `apps/worker/src/processors/__tests__/watchlist-match.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { matchWatchlists } from "../watchlist-match";
import { prisma } from "@genai/db";

vi.mock("@genai/db", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    watchlist: { findMany: vi.fn() },
    watchlistMatch: { upsert: vi.fn() },
  },
}));

describe("watchlist-match processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("matches event to watchlist by entity", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI releases GPT-5",
      mentions: [{ entityId: "ent_1" }],
      topics: [{ topicId: "topic_1" }],
    } as any);
    vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
      {
        id: "wl_1",
        entities: [{ entityId: "ent_1" }],
        topics: [],
        keywords: [],
      },
    ] as any);

    const result = await matchWatchlists({ eventId: "evt_1" });

    expect(result.matchesFound).toBe(1);
    expect(prisma.watchlistMatch.upsert).toHaveBeenCalled();
  });

  it("matches event to watchlist by topic", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test",
      mentions: [],
      topics: [{ topicId: "topic_1" }],
    } as any);
    vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
      {
        id: "wl_1",
        entities: [],
        topics: [{ topicId: "topic_1" }],
        keywords: [],
      },
    ] as any);

    const result = await matchWatchlists({ eventId: "evt_1" });

    expect(result.matchesFound).toBe(1);
  });

  it("matches event to watchlist by keyword", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "OpenAI releases GPT-5",
      mentions: [],
      topics: [],
    } as any);
    vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
      {
        id: "wl_1",
        entities: [],
        topics: [],
        keywords: ["openai", "gpt"],
      },
    ] as any);

    const result = await matchWatchlists({ eventId: "evt_1" });

    expect(result.matchesFound).toBe(1);
  });

  it("creates unseen match for notification", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt_1",
      title: "Test OpenAI",
      mentions: [],
      topics: [],
    } as any);
    vi.mocked(prisma.watchlist.findMany).mockResolvedValue([
      { id: "wl_1", entities: [], topics: [], keywords: ["openai"] },
    ] as any);

    await matchWatchlists({ eventId: "evt_1" });

    expect(prisma.watchlistMatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          seen: false,
        }),
      })
    );
  });
});
```

**Step 2: Run test**

```bash
cd apps/worker && pnpm test src/processors/__tests__/watchlist-match.test.ts
```

Expected: FAIL

---

### Task 15: Implement watchlist match processor

**Files:**
- Modify: `apps/worker/src/processors/watchlist-match.ts`

**Step 1: Implement the processor**

```typescript
import { Job, Worker } from "bullmq";
import { prisma } from "@genai/db";

export interface WatchlistMatchInput {
  eventId: string;
}

export interface WatchlistMatchResult {
  eventId: string;
  matchesFound: number;
  watchlistIds: string[];
}

export async function matchWatchlists(
  input: WatchlistMatchInput
): Promise<WatchlistMatchResult> {
  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: {
      mentions: { select: { entityId: true } },
      topics: { select: { topicId: true } },
    },
  });

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`);
  }

  const entityIds = event.mentions.map((m) => m.entityId);
  const topicIds = event.topics.map((t) => t.topicId);
  const titleLower = event.title.toLowerCase();

  // Find all watchlists
  const watchlists = await prisma.watchlist.findMany({
    include: {
      entities: { select: { entityId: true } },
      topics: { select: { topicId: true } },
    },
  });

  const matchedWatchlistIds: string[] = [];

  for (const watchlist of watchlists) {
    let matched = false;

    // Check entity match
    const watchlistEntityIds = watchlist.entities.map((e) => e.entityId);
    if (entityIds.some((id) => watchlistEntityIds.includes(id))) {
      matched = true;
    }

    // Check topic match
    const watchlistTopicIds = watchlist.topics.map((t) => t.topicId);
    if (!matched && topicIds.some((id) => watchlistTopicIds.includes(id))) {
      matched = true;
    }

    // Check keyword match
    if (!matched && watchlist.keywords.length > 0) {
      const keywordMatch = watchlist.keywords.some((kw) =>
        titleLower.includes(kw.toLowerCase())
      );
      if (keywordMatch) {
        matched = true;
      }
    }

    if (matched) {
      matchedWatchlistIds.push(watchlist.id);

      // Create match record
      await prisma.watchlistMatch.upsert({
        where: {
          watchlistId_eventId: {
            watchlistId: watchlist.id,
            eventId: input.eventId,
          },
        },
        create: {
          watchlistId: watchlist.id,
          eventId: input.eventId,
          seen: false,
        },
        update: {},
      });
    }
  }

  return {
    eventId: input.eventId,
    matchesFound: matchedWatchlistIds.length,
    watchlistIds: matchedWatchlistIds,
  };
}

export async function processWatchlistMatch(
  job: Job<WatchlistMatchInput>
): Promise<WatchlistMatchResult> {
  const result = await matchWatchlists(job.data);

  if (result.matchesFound > 0) {
    console.log(
      `[watchlist-match] Event ${result.eventId} matched ${result.matchesFound} watchlists`
    );
  }

  return result;
}

export function createWatchlistMatchWorker(connection: any): Worker {
  return new Worker("watchlist-match", processWatchlistMatch, {
    connection,
    concurrency: 5,
  });
}
```

**Step 2: Run tests**

```bash
cd apps/worker && pnpm test src/processors/__tests__/watchlist-match.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add apps/worker/src/processors/watchlist-match.ts apps/worker/src/processors/__tests__/watchlist-match.test.ts
git commit -m "feat(worker): implement watchlist-match processor"
```

---

## Sprint 2.8: Queue Orchestration

**Goal:** Wire up the complete pipeline and add feed trigger integration.

### Task 16: Update worker index to register all processors

**Files:**
- Modify: `apps/worker/src/index.ts`

**Step 1: Update worker index**

```typescript
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { createEvidenceSnapshotWorker } from "./processors/evidence-snapshot";
import { createEventCreateWorker } from "./processors/event-create";
import { createEventEnrichWorker } from "./processors/event-enrich";
import { createEntityExtractWorker } from "./processors/entity-extract";
import { createRelationshipExtractWorker } from "./processors/relationship-extract";
import { createTopicAssignWorker } from "./processors/topic-assign";
import { createWatchlistMatchWorker } from "./processors/watchlist-match";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function main() {
  console.log("[worker] Starting GenAI2 worker...");
  console.log(`[worker] Connecting to Redis: ${REDIS_URL}`);

  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // Create queues for job enqueueing
  const queues = {
    evidenceSnapshot: new Queue("evidence-snapshot", { connection }),
    eventCreate: new Queue("event-create", { connection }),
    eventEnrich: new Queue("event-enrich", { connection }),
    entityExtract: new Queue("entity-extract", { connection }),
    relationshipExtract: new Queue("relationship-extract", { connection }),
    topicAssign: new Queue("topic-assign", { connection }),
    watchlistMatch: new Queue("watchlist-match", { connection }),
  };

  // Create workers
  const workers: Worker[] = [
    createEvidenceSnapshotWorker(connection),
    createEventCreateWorker(connection),
    createEventEnrichWorker(connection),
    createEntityExtractWorker(connection),
    createRelationshipExtractWorker(connection),
    createTopicAssignWorker(connection),
    createWatchlistMatchWorker(connection),
  ];

  // Set up pipeline flow: job completion triggers next step
  workers[0].on("completed", async (job, result) => {
    // evidence-snapshot → event-create
    if (job && result) {
      await queues.eventCreate.add("create", {
        title: job.data.title,
        occurredAt: job.data.publishedAt || new Date(),
        sourceType: job.data.sourceType || "HN",
        sourceId: job.data.sourceId || job.id,
        snapshotId: result.snapshotId,
      });
    }
  });

  workers[1].on("completed", async (job, result) => {
    // event-create → event-enrich (only for new events)
    if (result?.created) {
      await queues.eventEnrich.add("enrich", { eventId: result.eventId });
    }
  });

  workers[2].on("completed", async (job, result) => {
    // event-enrich → entity-extract, topic-assign (parallel)
    if (result?.artifactsCreated.length > 0) {
      await Promise.all([
        queues.entityExtract.add("extract", { eventId: result.eventId }),
        queues.topicAssign.add("assign", { eventId: result.eventId }),
      ]);
    }
  });

  workers[3].on("completed", async (job, result) => {
    // entity-extract → relationship-extract (if entities found)
    if (result?.entitiesExtracted >= 2) {
      await queues.relationshipExtract.add("extract", { eventId: result.eventId });
    }
  });

  workers[5].on("completed", async (job, result) => {
    // topic-assign → watchlist-match
    if (result?.topicsAssigned > 0) {
      await queues.watchlistMatch.add("match", { eventId: job.data.eventId });
    }
  });

  console.log(`[worker] Started ${workers.length} workers`);
  console.log("[worker] Pipeline: evidence-snapshot → event-create → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[worker] Shutting down...");
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});

export { main };
```

**Step 2: Commit**

```bash
git add apps/worker/src/index.ts
git commit -m "feat(worker): wire up complete event pipeline"
```

---

### Task 17: Create feed ingestion trigger

**Files:**
- Create: `apps/worker/src/triggers/feed-ingest.ts`

**Step 1: Implement feed trigger**

```typescript
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchHNFeed, fetchGitHubFeed, fetchArxivFeed } from "@genai/trpc/services";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export async function ingestFeeds() {
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const evidenceQueue = new Queue("evidence-snapshot", { connection });

  console.log("[feed-ingest] Fetching feeds...");

  // Fetch all feeds in parallel
  const [hnEvents, githubEvents, arxivEvents] = await Promise.all([
    fetchHNFeed().catch((err) => {
      console.error("[feed-ingest] HN fetch failed:", err.message);
      return [];
    }),
    fetchGitHubFeed().catch((err) => {
      console.error("[feed-ingest] GitHub fetch failed:", err.message);
      return [];
    }),
    fetchArxivFeed().catch((err) => {
      console.error("[feed-ingest] arXiv fetch failed:", err.message);
      return [];
    }),
  ]);

  console.log(`[feed-ingest] Fetched: HN=${hnEvents.length}, GitHub=${githubEvents.length}, arXiv=${arxivEvents.length}`);

  // Enqueue evidence snapshots
  const jobs = [];

  for (const event of hnEvents) {
    jobs.push({
      name: "hn",
      data: {
        rawUrl: event.url,
        title: event.title,
        author: event.author,
        publishedAt: event.publishedAt,
        sourceType: "HN",
        sourceId: event.id,
      },
    });
  }

  for (const event of githubEvents) {
    jobs.push({
      name: "github",
      data: {
        rawUrl: event.url,
        title: event.title,
        publishedAt: event.publishedAt,
        sourceType: "GITHUB",
        sourceId: event.id,
      },
    });
  }

  for (const event of arxivEvents) {
    jobs.push({
      name: "arxiv",
      data: {
        rawUrl: event.url,
        title: event.title,
        author: event.author,
        publishedAt: event.publishedAt,
        sourceType: "ARXIV",
        sourceId: event.id,
      },
    });
  }

  if (jobs.length > 0) {
    await evidenceQueue.addBulk(jobs);
    console.log(`[feed-ingest] Enqueued ${jobs.length} evidence snapshots`);
  }

  await connection.quit();
}

// Run if called directly
if (require.main === module) {
  ingestFeeds()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[feed-ingest] Error:", err);
      process.exit(1);
    });
}
```

**Step 2: Add script to package.json**

```bash
cd apps/worker
# Add to package.json scripts:
# "ingest": "tsx src/triggers/feed-ingest.ts"
```

**Step 3: Commit**

```bash
git add apps/worker/src/triggers/feed-ingest.ts apps/worker/package.json
git commit -m "feat(worker): add feed ingestion trigger"
```

---

### Task 18: Add integration test for full pipeline

**Files:**
- Create: `apps/worker/src/__tests__/pipeline.integration.test.ts`

**Step 1: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

describe("Event Pipeline Integration", () => {
  let connection: IORedis;
  let queues: Record<string, Queue>;

  beforeAll(() => {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });

    queues = {
      evidenceSnapshot: new Queue("evidence-snapshot-test", { connection }),
      eventCreate: new Queue("event-create-test", { connection }),
    };
  });

  afterAll(async () => {
    await Promise.all(Object.values(queues).map((q) => q.close()));
    await connection.quit();
  });

  it("processes evidence snapshot through pipeline", async () => {
    const results: string[] = [];

    // Create test workers
    const snapshotWorker = new Worker(
      "evidence-snapshot-test",
      async (job) => {
        results.push(`snapshot:${job.data.rawUrl}`);
        return { snapshotId: "snap_test" };
      },
      { connection }
    );

    const createWorker = new Worker(
      "event-create-test",
      async (job) => {
        results.push(`create:${job.data.snapshotId}`);
        return { eventId: "evt_test", created: true };
      },
      { connection }
    );

    // Wire up flow
    snapshotWorker.on("completed", async (job, result) => {
      await queues.eventCreate.add("create", { snapshotId: result.snapshotId });
    });

    // Add test job
    await queues.evidenceSnapshot.add("test", {
      rawUrl: "https://test.com/article",
      title: "Test Article",
    });

    // Wait for processing
    await new Promise((r) => setTimeout(r, 2000));

    expect(results).toContain("snapshot:https://test.com/article");
    expect(results).toContain("create:snap_test");

    await snapshotWorker.close();
    await createWorker.close();
  });
});
```

**Step 2: Run integration test**

```bash
cd apps/worker && pnpm test src/__tests__/pipeline.integration.test.ts
```

**Step 3: Commit**

```bash
git add apps/worker/src/__tests__/pipeline.integration.test.ts
git commit -m "test(worker): add pipeline integration test"
```

---

### Task 19: Update documentation

**Files:**
- Modify: `docs/ROADMAP.md`

**Step 1: Update roadmap to mark Phase 2 items complete**

Update the Phase 2 section with checkboxes:

```markdown
## Phase 2: Event Pipeline ✅ COMPLETE

**Owner:** Worker

**Goal:** Events flow automatically with GM processing

* [x] evidence-snapshot processor
* [x] event-create processor
* [x] event-enrich processor
* [x] entity-extract processor
* [x] relationship-extract + safety gate
* [x] topic-assign processor
* [x] watchlist-match processor
* [x] Queue orchestration

**Gate:**

* [x] New HN post → Event with artifacts in < 2 minutes
```

**Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark Phase 2 Event Pipeline complete"
```

---

## Gate Verification

Run the following to verify Phase 2 is complete:

```bash
# 1. Run all tests
pnpm test

# 2. Start worker
cd apps/worker && pnpm dev

# 3. In another terminal, trigger feed ingestion
cd apps/worker && pnpm ingest

# 4. Watch logs - should see pipeline process:
# [evidence-snapshot] Created snapshot...
# [event-create] Created event...
# [event-enrich] Enriched event with 3 artifacts...
# [entity-extract] Extracted 2 entities...
# [topic-assign] Assigned 2 topics...

# 5. Verify in database
cd packages/db && pnpm studio
# Check: events, event_artifacts, entities, entity_mentions, event_topics
```

**Phase 2 Gate:**
- [ ] New HN post → Event with artifacts in < 2 minutes
- [ ] All processors have tests
- [ ] Pipeline handles errors gracefully

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1-2 | Evidence Snapshot Processor | `evidence-snapshot.ts`, tests |
| 3-4 | Event Create Processor | `event-create.ts`, tests |
| 5-7 | Event Enrich Processor | `gemini.ts`, `event-enrich.ts`, tests |
| 8-9 | Entity Extract Processor | `entity-extract.ts`, tests |
| 10-11 | Relationship Extract Processor | `relationship-extract.ts`, tests |
| 12-13 | Topic Assign Processor | `topic-assign.ts`, tests |
| 14-15 | Watchlist Match Processor | `watchlist-match.ts`, tests |
| 16-18 | Queue Orchestration | `index.ts`, `feed-ingest.ts`, integration tests |
| 19 | Documentation | `ROADMAP.md` |
