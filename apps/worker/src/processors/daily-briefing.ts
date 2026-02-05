import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse, LLMUsage } from "@genai/llm";
import { calculateGeminiCost, hashString } from "@genai/llm";
import { DailyBriefingPayload } from "@genai/shared/schemas/daily-briefing";
import type { DailyBriefingPayload as DailyBriefingPayloadT } from "@genai/shared/schemas/daily-briefing";

// Local imports
import type {
  DailyBriefingJob,
  DailyBriefingInput,
  DailyBriefingResult,
  EventForBriefing,
} from "./daily-briefing.types";
import {
  PROCESSOR_NAME,
  log,
  buildEventsText,
  countUniqueSources,
  extractTopEntities,
  parseJsonResponse,
} from "./daily-briefing.utils";
import {
  generateBriefingPrompt,
  generateLegacyBriefingPrompt,
} from "./daily-briefing.prompts";
import { generateEpisode } from "./daily-briefing.cast";

// Re-export types for external consumers
export type {
  DailyBriefingJob,
  DailyBriefingInput,
  DailyBriefingResult,
} from "./daily-briefing.types";

// Re-export utilities for tests
export {
  buildEventsText,
  countUniqueSources,
  extractTopEntities,
  parseJsonResponse,
} from "./daily-briefing.utils";

// Re-export prompts for tests
export {
  generateBriefingPrompt,
  generateLegacyBriefingPrompt,
} from "./daily-briefing.prompts";

// ============================================================================
// DAILY BRIEFING PROCESSOR
// ============================================================================
// Generates daily GM briefings with top events and predictions
// Implements Architecture Constitution #3, #8, #9
//
// #3: STRUCTURED OVER TEXT - Payload is typed JSON validated by Zod
// #8: GM AS VERSIONED SERVICE - Outputs link to LLMRun with version/hash
// #9: OBSERVABILITY BUILT-IN - Every call logs model, tokens, cost, latency
//
// LLM Cost Estimate:
// - Expected cost per briefing: ~$0.04-0.06 (10 events context)
// - Expected daily cost: ~$0.06 (1 briefing/day, fallback = 2 calls max)
// - Mitigation: Cron job runs once at 05:00 UTC only

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Generate a daily briefing for the specified date.
 *
 * This function:
 * 1. Checks if briefing already exists for the date
 * 2. Loads top 10 published events from that day
 * 3. Generates Council Roundtable via LLM (falls back to legacy format)
 * 4. Creates DailyBriefing record with linked items
 *
 * @param input - The briefing input with date
 * @param client - LLM client to use for generation
 * @returns Result with briefingId and event count
 */
export async function generateDailyBriefing(
  input: DailyBriefingInput,
  client: LLMClient
): Promise<DailyBriefingResult> {
  const { date } = input;

  log(`Generating daily briefing for ${date}`);

  // Parse date and get day boundaries
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if briefing already exists
  const existing = await prisma.dailyBriefing.findUnique({
    where: { date: startOfDay },
  });

  if (existing) {
    log(`Briefing for ${date} already exists: ${existing.id}`);
    return {
      success: true,
      briefingId: existing.id,
      eventCount: 0,
    };
  }

  // Get top events from the day
  const events = (await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      occurredAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      OR: [
        { confidence: "HIGH" },
        { confidence: "MEDIUM" },
        { confidence: null },
      ],
    },
    include: {
      artifacts: {
        where: {
          artifactType: {
            in: ["HEADLINE", "SUMMARY", "WHAT_HAPPENED", "WHY_MATTERS"],
          },
        },
      },
      evidence: {
        include: { snapshot: { include: { source: true } } },
      },
      mentions: {
        include: { entity: true },
      },
    },
    orderBy: [
      { impactLevel: "asc" },
      { sourceCount: "desc" },
      { occurredAt: "desc" },
    ],
    take: 10,
  })) as EventForBriefing[];

  if (events.length === 0) {
    log(`No published events found for ${date}`);
    return {
      success: true,
      eventCount: 0,
    };
  }

  // Build context for LLM
  const eventsText = buildEventsText(events);
  const sourceCount = countUniqueSources(events);
  const topEntities = extractTopEntities(events, 5);

  // 3-tier generation: Director/Cast → single-call roundtable → legacy
  const inputHash = hashString(eventsText);
  const startTime = Date.now();
  let payload: DailyBriefingPayloadT;
  let totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let processorTag = PROCESSOR_NAME;
  let promptHash = inputHash;

  // === Tier 1: Director/Cast multi-turn ===
  if (client.chat) {
    try {
      const episode = await generateEpisode({ client, events, eventsText, date });

      // Build payload with roundtable from episode + placeholder metadata
      payload = DailyBriefingPayload.parse({
        roundtable: episode.roundtable,
        prediction: { en: "See roundtable discussion above.", hr: "Pogledajte raspravu iznad.", confidence: "medium" as const },
        eventCount: events.length,
        sourceCount: sourceCount,
        topEntities,
      });

      totalUsage = episode.totalUsage;
      processorTag = "daily-briefing/cast";
      promptHash = hashString("director-cast-v3");
      log(`Director/Cast produced ${episode.roundtable.length} turns in ${episode.turnCount} calls`);
    } catch (castError) {
      log(`Director/Cast failed: ${castError}, falling back to single-call`);
      // Fall through to Tier 2
    }
  }

  // === Tier 2: Single-call roundtable (existing) ===
  // @ts-expect-error payload may not be assigned yet if Tier 1 skipped/failed
  if (!payload) {
    const prompt = generateBriefingPrompt(eventsText, date);
    promptHash = hashString(prompt);

    let response: LLMResponse;
    try {
      response = await client.complete(prompt);
    } catch (error) {
      log(`Single-call LLM failed: ${error}`);
      // Fall through to Tier 3
      response = undefined as unknown as LLMResponse;
    }

    if (response) {
      try {
        const parsed = parseJsonResponse(response.content);
        payload = DailyBriefingPayload.parse(parsed);
        if (!payload.roundtable || payload.roundtable.length < 4) {
          throw new Error("Roundtable too short or missing");
        }
        totalUsage = response.usage;
        log(`Single-call roundtable produced ${payload.roundtable.length} turns`);
      } catch (roundtableError) {
        log(`Roundtable parse failed: ${roundtableError}, falling back to legacy`);
        // Fall through to Tier 3
      }
    }
  }

  // === Tier 3: Legacy changedSince format ===
  // @ts-expect-error payload may not be assigned yet if Tier 1+2 failed
  if (!payload) {
    const legacyPrompt = generateLegacyBriefingPrompt(eventsText, date);
    promptHash = hashString(legacyPrompt);
    let legacyResponse: LLMResponse;
    try {
      legacyResponse = await client.complete(legacyPrompt);
    } catch (error) {
      log(`Legacy LLM call also failed: ${error}`);
      return {
        success: false,
        eventCount: events.length,
        error: `LLM call failed: ${error}`,
      };
    }

    try {
      const legacyParsed = parseJsonResponse(legacyResponse.content);
      payload = DailyBriefingPayload.parse(legacyParsed);
      totalUsage = legacyResponse.usage;
    } catch (legacyError) {
      log(`Legacy parse also failed: ${legacyError}`);
      return {
        success: false,
        eventCount: events.length,
        error: `Parse error: ${legacyError}`,
      };
    }
  }

  const latencyMs = Date.now() - startTime;

  // Ensure metadata is accurate
  payload.eventCount = events.length;
  payload.sourceCount = sourceCount;
  payload.topEntities = topEntities;

  // Create briefing in transaction
  const briefing = await prisma.$transaction(async (tx) => {
    const runId = crypto.randomUUID();

    // Create LLM run record for cost tracking
    await tx.lLMRun.create({
      data: {
        id: runId,
        provider: client.provider,
        model: client.model,
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        totalTokens: totalUsage.totalTokens,
        costCents: calculateGeminiCost(
          totalUsage.inputTokens,
          totalUsage.outputTokens
        ),
        latencyMs,
        promptHash,
        inputHash,
        processorName: processorTag,
      },
    });

    // Create briefing with items
    const briefing = await tx.dailyBriefing.create({
      data: {
        date: startOfDay,
        payload: payload as object,
        runId,
        items: {
          create: events.slice(0, 5).map((e, i) => ({
            eventId: e.id,
            rank: i + 1,
          })),
        },
      },
    });

    return briefing;
  });

  log(`Created briefing ${briefing.id} with ${events.length} events`);

  return {
    success: true,
    briefingId: briefing.id,
    eventCount: events.length,
  };
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process a daily briefing job from the queue.
 *
 * @param job - The BullMQ job containing date
 */
export async function processDailyBriefing(
  job: Job<DailyBriefingJob>
): Promise<DailyBriefingResult> {
  const { date } = job.data;

  log(`Processing daily briefing for ${date}`);

  // Get LLM client from environment
  const { createDefaultLLMClient } = await import("@genai/llm");
  const client = createDefaultLLMClient();

  return generateDailyBriefing({ date }, client);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for daily briefing processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createDailyBriefingWorker(connection: ConnectionOptions): Worker {
  return new Worker("daily-briefing", processDailyBriefing, {
    connection,
  });
}
