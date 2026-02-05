import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { calculateGeminiCost, hashString } from "@genai/llm";
import { DailyBriefingPayload } from "@genai/shared/schemas/daily-briefing";

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
  generateBriefingPrompt,
  parseJsonResponse,
} from "./daily-briefing.utils";

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
  generateBriefingPrompt,
  parseJsonResponse,
} from "./daily-briefing.utils";

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
// - Expected cost per briefing: ~$0.05 (10 events context)
// - Expected daily cost: ~$0.05 (1 briefing/day)
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
 * 3. Generates GM commentary via LLM
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
        where: { artifactType: { in: ["HEADLINE", "SUMMARY"] } },
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

  // Generate briefing via LLM
  const prompt = generateBriefingPrompt(eventsText, date);
  const promptHash = hashString(prompt);
  const inputHash = hashString(eventsText);

  const startTime = Date.now();
  let response: LLMResponse;
  try {
    response = await client.complete(prompt);
  } catch (error) {
    log(`LLM call failed: ${error}`);
    return {
      success: false,
      eventCount: events.length,
      error: `LLM call failed: ${error}`,
    };
  }
  const latencyMs = Date.now() - startTime;

  // Parse and validate response
  let payload: DailyBriefingPayload;
  try {
    const parsed = parseJsonResponse(response.content);
    payload = DailyBriefingPayload.parse(parsed);
  } catch (error) {
    log(`Failed to parse response: ${error}`);
    return {
      success: false,
      eventCount: events.length,
      error: `Parse error: ${error}`,
    };
  }

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
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        costCents: calculateGeminiCost(
          response.usage.inputTokens,
          response.usage.outputTokens
        ),
        latencyMs,
        promptHash,
        inputHash,
        processorName: PROCESSOR_NAME,
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
