import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { hashString } from "@genai/llm";
import { TopicAssignPayload } from "@genai/shared/schemas/artifacts";

// Local imports
import type {
  TopicAssignJob,
  TopicAssignInput,
  TopicAssignResult,
  EventWithEvidence,
  TopicData,
} from "./topic-assign.types";
import {
  PROCESSOR_NAME,
  PROMPT_VERSION,
  log,
  buildEventText,
  calculateCost,
  TOPIC_ASSIGN_PROMPT,
} from "./topic-assign.utils";

// Re-export types for external consumers
export type {
  TopicAssignJob,
  TopicAssignInput,
  TopicAssignResult,
} from "./topic-assign.types";

// Re-export utilities that may be needed by tests
export { buildEventText } from "./topic-assign.utils";

// ============================================================================
// TOPIC ASSIGN PROCESSOR - Architecture Constitution #3, #8, #9
// ============================================================================

/**
 * Assign topics to an enriched event.
 *
 * This function:
 * 1. Loads the event with its evidence snapshots
 * 2. Skips if not in ENRICHED status
 * 3. Fetches available topics from database
 * 4. Uses LLM to assign 1-3 relevant topics with confidence
 * 5. Creates EventTopic joins with LLM origin
 * 6. Creates TOPIC_ASSIGN artifact
 * 7. Logs LLM run for cost tracking
 *
 * @param input - The assignment input with eventId
 * @param client - LLM client to use for topic assignment
 * @returns Result with topics assigned count
 */
export async function assignTopics(
  input: TopicAssignInput,
  client: LLMClient
): Promise<TopicAssignResult> {
  const { eventId } = input;

  log(`Starting topic assignment for event ${eventId}`);

  return prisma.$transaction(async (tx) => {
    // Load event with evidence
    const event = (await tx.event.findUnique({
      where: { id: eventId },
      include: {
        evidence: {
          include: {
            snapshot: true,
          },
        },
      },
    })) as EventWithEvidence | null;

    // Check if event exists
    if (!event) {
      log(`Event ${eventId} not found`);
      return {
        success: false,
        eventId,
        topicsAssigned: 0,
        error: `Event ${eventId} not found`,
      };
    }

    // Check status - only process ENRICHED events
    if (event.status !== "ENRICHED") {
      log(`Event ${eventId} not in ENRICHED status (current: ${event.status}), skipping`);
      return {
        success: true,
        eventId,
        topicsAssigned: 0,
        skipped: true,
        skipReason: `Event not in ENRICHED status (current: ${event.status})`,
      };
    }

    // Fetch all available topics from database
    const availableTopics = (await tx.topic.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
      },
    })) as TopicData[];

    if (availableTopics.length === 0) {
      log(`No topics available in database for event ${eventId}`);
      return {
        success: true,
        eventId,
        topicsAssigned: 0,
        skipped: true,
        skipReason: "No topics available in database",
      };
    }

    // Build event context
    const eventText = buildEventText(event.title, event.evidence);

    // Build prompt
    const prompt = TOPIC_ASSIGN_PROMPT(eventText, availableTopics);
    const promptHash = hashString(prompt);
    const inputHash = hashString(eventText);

    // Call LLM and measure latency
    log(`Calling LLM to assign topics for event ${eventId}`);
    const startTime = Date.now();
    let response: LLMResponse;
    try {
      response = await client.complete(prompt);
    } catch (error) {
      log(`LLM call failed for topic assignment: ${error}`);
      throw error;
    }
    const latencyMs = Date.now() - startTime;

    // Parse and validate response
    let payload: TopicAssignPayload;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = response.content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      }
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);
      payload = TopicAssignPayload.parse(parsed);
    } catch (error) {
      log(`Failed to parse topic assignment response: ${error}`);
      throw new Error(
        `Failed to parse topic assignment response: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Calculate cost
    const costCents = calculateCost(
      client.provider,
      response.usage.inputTokens,
      response.usage.outputTokens
    );

    // Generate run ID for linking artifact to LLM run
    const runId = crypto.randomUUID();

    // Create LLM run record
    await tx.lLMRun.create({
      data: {
        id: runId,
        provider: client.provider,
        model: client.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
        costCents,
        latencyMs,
        promptHash,
        inputHash,
        processorName: PROCESSOR_NAME,
        eventId,
      },
    });

    // Build map of slug -> topic for quick lookup
    const topicsBySlug = new Map(availableTopics.map((t) => [t.slug, t]));

    // Process each assigned topic (filter out unknown slugs)
    let topicsAssigned = 0;
    const validTopics: Array<{ slug: string; confidence: number }> = [];

    for (const topicAssignment of payload.topics) {
      const topic = topicsBySlug.get(topicAssignment.slug);

      if (!topic) {
        log(`Skipping unknown topic slug: ${topicAssignment.slug}`);
        continue;
      }

      // Create EventTopic join with LLM origin
      await tx.eventTopic.create({
        data: {
          eventId,
          topicId: topic.id,
          confidence: topicAssignment.confidence,
          origin: "LLM",
        },
      });

      validTopics.push(topicAssignment);
      topicsAssigned++;

      log(`Assigned topic ${topicAssignment.slug} with confidence ${topicAssignment.confidence}`);
    }

    // Create artifact with only valid topics
    await tx.eventArtifact.create({
      data: {
        eventId,
        artifactType: "TOPIC_ASSIGN",
        version: 1,
        payload: { topics: validTopics } as unknown as object,
        modelUsed: client.model,
        promptVersion: PROMPT_VERSION,
        promptHash,
        inputHash,
        runId,
      },
    });

    log(`Event ${eventId} topic assignment complete: ${topicsAssigned} topics`);

    return {
      success: true,
      eventId,
      topicsAssigned,
    };
  });
}

/** Process a topic assign job from the queue. */
export async function processTopicAssign(
  job: Job<TopicAssignJob>
): Promise<TopicAssignResult> {
  const { eventId } = job.data;

  log(`Processing topic assignment for ${eventId}`);

  // Get LLM client from environment
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }

  // Import dynamically to avoid circular dependencies
  const { createGeminiClient } = await import("@genai/llm");
  const client = createGeminiClient(apiKey);

  return assignTopics({ eventId }, client);
}

/** Create a BullMQ worker for topic assignment processing. */
export function createTopicAssignWorker(connection: ConnectionOptions): Worker {
  return new Worker("topic-assign", processTopicAssign, {
    connection,
  });
}
