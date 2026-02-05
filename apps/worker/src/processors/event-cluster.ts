import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import {
  createDefaultLLMClient,
  hashString,
  calculateLLMCost,
} from "@genai/llm";
import type { LLMClient } from "@genai/llm";
import { ClusterDecisionSchema } from "@genai/shared";

// ============================================================================
// EVENT CLUSTER PROCESSOR
// ============================================================================
// LLM-as-judge for event deduplication / clustering.
// Receives a snapshot, finds candidate events within 72h, and decides
// whether the snapshot belongs to an existing event or is new.
//
// Implements Architecture Constitution #6: Event-driven pipelines
// Implements Architecture Constitution #9: Observability built-in

// ============================================================================
// CONSTANTS
// ============================================================================

const PREFILTER_THRESHOLD = 0.15;
const MAX_CANDIDATES = 10;
const TIME_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
const PROCESSOR_NAME = "event-cluster";
const QUEUE_NAME = "event-cluster";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EventClusterJob {
  snapshotId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
}

export interface EventClusterResult {
  snapshotId: string;
  matchedEventId: string | null;
  decision: "match" | "new";
  sourceType: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
}

interface CandidateEvent {
  id: string;
  title: string;
  sourceCount: number;
}

// ============================================================================
// LOGGING
// ============================================================================

function log(message: string): void {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[${PROCESSOR_NAME}] ${message}`);
  }
}

// ============================================================================
// BIGRAM SIMILARITY
// ============================================================================

function getBigrams(str: string): Set<string> {
  const normalized = str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
  const words = normalized.split(/\s+/);
  const bigrams = new Set<string>();
  for (const word of words) {
    for (let i = 0; i < word.length - 1; i++) {
      bigrams.add(word.slice(i, i + 2));
    }
  }
  return bigrams;
}

/**
 * Compute Dice-Sorensen bigram similarity between two titles.
 *
 * @param a - First title
 * @param b - Second title
 * @returns Similarity score between 0.0 and 1.0
 */
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
// LLM PROMPT
// ============================================================================

function buildClusterPrompt(
  title: string,
  candidates: CandidateEvent[]
): string {
  const candidateLines = candidates
    .map(
      (c, i) => `  ${i + 1}. [${c.id}] "${c.title}" (${c.sourceCount} source(s))`
    )
    .join("\n");

  return `You are an event deduplication judge for an AI news observatory.

INCOMING SNAPSHOT:
"${title}"

CANDIDATE EVENTS (may describe the same real-world event):
${candidateLines}

TASK: Decide if the incoming snapshot describes the SAME real-world event as any candidate.

Rules:
- Same event = same announcement, release, funding round, paper, etc.
- Different coverage angles of the SAME event = MATCH
- Related but distinct events = NO MATCH
- When uncertain, prefer NO MATCH

Respond with ONLY a JSON object:
{
  "matchedEventId": "<event ID>" or null,
  "confidence": <0.0 to 1.0>,
  "reason": "<brief explanation, max 200 chars>"
}`;
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Cluster a snapshot against existing events using bigram prefilter + LLM judge.
 *
 * Steps:
 * 1. Check idempotency (snapshot already linked to an event)
 * 2. Fetch recent events within 72h time window
 * 3. Prefilter by title bigram similarity (threshold 0.15)
 * 4. If no candidates pass prefilter, return "new" (skip LLM)
 * 5. Make ONE LLM call with all candidates (max 10)
 * 6. Validate response with ClusterDecisionSchema
 * 7. Return matchedEventId or null
 *
 * @param job - The event cluster job data
 * @param client - Optional LLM client (injectable for testing)
 * @returns The cluster result with decision
 */
export async function clusterSnapshot(
  job: EventClusterJob,
  client?: LLMClient
): Promise<EventClusterResult> {
  const { snapshotId, sourceType, sourceId, title, publishedAt } = job;

  // Step 1: Idempotency check - is this snapshot already linked?
  const existingLink = await prisma.eventEvidence.findFirst({
    where: { snapshotId },
  });

  if (existingLink) {
    log(`Snapshot ${snapshotId} already linked to event ${existingLink.eventId}`);
    return {
      snapshotId,
      matchedEventId: existingLink.eventId,
      decision: "match",
      sourceType,
      sourceId,
      title,
      publishedAt,
    };
  }

  // Step 2: Fetch recent events within 72h window
  const referenceDate = publishedAt ? new Date(publishedAt) : new Date();
  const windowStart = new Date(referenceDate.getTime() - TIME_WINDOW_MS);
  const windowEnd = new Date(referenceDate.getTime() + TIME_WINDOW_MS);

  const recentEvents = await prisma.event.findMany({
    where: {
      occurredAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      title: true,
      sourceCount: true,
    },
    orderBy: { occurredAt: "desc" },
  });

  log(`Found ${recentEvents.length} events within 72h window`);

  // Step 3: Prefilter by bigram similarity
  const candidates: CandidateEvent[] = recentEvents
    .filter((event) => titleSimilarity(title, event.title) >= PREFILTER_THRESHOLD)
    .slice(0, MAX_CANDIDATES);

  log(
    `${candidates.length} candidates passed prefilter (threshold=${PREFILTER_THRESHOLD})`
  );

  // Step 4: No candidates -> return "new" (skip LLM)
  if (candidates.length === 0) {
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

  // Step 5: LLM judge call
  const llmClient = client ?? createDefaultLLMClient();
  const prompt = buildClusterPrompt(title, candidates);
  const promptHash = hashString(prompt);
  const inputHash = hashString(title);

  const startMs = Date.now();

  let matchedEventId: string | null = null;

  try {
    const response = await llmClient.complete(prompt);
    const latencyMs = Date.now() - startMs;

    // Log LLM run for observability
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

    log(
      `LLM call completed in ${latencyMs}ms (${response.usage.totalTokens} tokens)`
    );

    // Step 6: Parse and validate response
    const rawContent = response.content.trim();
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch =
      rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      rawContent.match(/(\{[\s\S]*\})/);

    if (!jsonMatch?.[1]) {
      log("LLM response did not contain valid JSON, defaulting to 'new'");
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

    const parsed: unknown = JSON.parse(jsonMatch[1]);
    const decision = ClusterDecisionSchema.parse(parsed);

    matchedEventId = decision.matchedEventId;

    // Step 7: Validate matchedEventId exists in candidate list
    if (matchedEventId !== null) {
      const validIds = new Set(candidates.map((c) => c.id));
      if (!validIds.has(matchedEventId)) {
        log(
          `LLM returned matchedEventId "${matchedEventId}" not in candidate list, defaulting to 'new'`
        );
        matchedEventId = null;
      }
    }

    log(
      `Decision: ${matchedEventId ? "match" : "new"} (confidence=${decision.confidence}, reason="${decision.reason}")`
    );
  } catch (error) {
    // On any LLM/parse failure -> default to "new" (safe fallback)
    const latencyMs = Date.now() - startMs;
    log(
      `LLM call failed after ${latencyMs}ms: ${error instanceof Error ? error.message : String(error)}`
    );

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

  return {
    snapshotId,
    matchedEventId,
    decision: matchedEventId ? "match" : "new",
    sourceType,
    sourceId,
    title,
    publishedAt,
  };
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process an event cluster job from the queue.
 *
 * @param job - The BullMQ job containing cluster data
 * @returns The cluster result
 */
export async function processEventCluster(
  job: Job<EventClusterJob>
): Promise<EventClusterResult> {
  log(`Processing cluster job for snapshot ${job.data.snapshotId}`);

  const result = await clusterSnapshot(job.data);

  log(
    `Cluster result: snapshot=${result.snapshotId} decision=${result.decision} matchedEventId=${result.matchedEventId ?? "none"}`
  );

  return result;
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for event clustering.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createEventClusterWorker(connection: ConnectionOptions): Worker {
  return new Worker(QUEUE_NAME, processEventCluster, {
    connection,
  });
}
