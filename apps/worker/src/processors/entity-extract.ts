import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { hashString } from "@genai/llm";
import { EntityExtractPayload } from "@genai/shared/schemas/artifacts";

// Local imports
import type {
  EntityExtractJob,
  EntityExtractInput,
  EntityExtractResult,
  EventWithEvidence,
} from "./entity-extract.types";
import {
  PROCESSOR_NAME,
  PROMPT_VERSION,
  log,
  slugify,
  buildEvidenceText,
  calculateCost,
  ENTITY_EXTRACT_PROMPT,
} from "./entity-extract.utils";

// Re-export types for external consumers
export type {
  EntityExtractJob,
  EntityExtractInput,
  EntityExtractResult,
} from "./entity-extract.types";

// Re-export utilities that may be needed by tests
export { slugify } from "./entity-extract.utils";

// ============================================================================
// ENTITY EXTRACT PROCESSOR
// ============================================================================
// Extracts entities from enriched events using LLM
// Implements Architecture Constitution #3, #8, #9
//
// #3: STRUCTURED OVER TEXT - Entity payloads are typed JSON
// #8: GM AS VERSIONED SERVICE - Outputs are artifacts with version, model, prompt hash
// #9: OBSERVABILITY BUILT-IN - Every LLM call logs model, tokens, cost, latency

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Extract entities from an enriched event.
 *
 * This function:
 * 1. Loads the event with its evidence snapshots
 * 2. Skips if not in ENRICHED status
 * 3. Uses LLM to extract entities
 * 4. Upserts Entity records with slugs
 * 5. Creates EntityMention joins
 * 6. Creates ENTITY_EXTRACT artifact
 * 7. Logs LLM run for cost tracking
 *
 * @param input - The extraction input with eventId
 * @param client - LLM client to use for extraction
 * @returns Result with entities extracted count
 */
export async function extractEntities(
  input: EntityExtractInput,
  client: LLMClient
): Promise<EntityExtractResult> {
  const { eventId } = input;

  log(`Starting entity extraction for event ${eventId}`);

  // Load event with evidence (outside transaction - read-only)
  const event = (await prisma.event.findUnique({
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
      entitiesExtracted: 0,
      error: `Event ${eventId} not found`,
    };
  }

  // Check status - only process ENRICHED events
  if (event.status !== "ENRICHED") {
    log(`Event ${eventId} not in ENRICHED status (current: ${event.status}), skipping`);
    return {
      success: true,
      eventId,
      entitiesExtracted: 0,
      skipped: true,
      skipReason: `Event not in ENRICHED status (current: ${event.status})`,
    };
  }

  // Build evidence context
  const evidenceText = buildEvidenceText(event.evidence);

  // Build prompt
  const prompt = ENTITY_EXTRACT_PROMPT(event.title, evidenceText);
  const promptHash = hashString(prompt);
  const inputHash = hashString(evidenceText);

  // Call LLM and measure latency (outside transaction - slow I/O)
  log(`Calling LLM to extract entities for event ${eventId}`);
  const startTime = Date.now();
  let response: LLMResponse;
  try {
    response = await client.complete(prompt);
  } catch (error) {
    log(`LLM call failed for entity extraction: ${error}`);
    throw error;
  }
  const latencyMs = Date.now() - startTime;

  // Parse and validate response
  let payload: EntityExtractPayload;
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
    payload = EntityExtractPayload.parse(parsed);
  } catch (error) {
    log(`Failed to parse entity extraction response: ${error}`);
    throw new Error(
      `Failed to parse entity extraction response: ${error instanceof Error ? error.message : String(error)}`
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

  // Write all results in a single fast transaction (DB writes only)
  return prisma.$transaction(async (tx) => {
    // Re-check status inside transaction to prevent races
    const current = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });
    if (current?.status !== "ENRICHED") {
      return {
        success: true,
        eventId,
        entitiesExtracted: 0,
        skipped: true,
        skipReason: `Event status changed to ${current?.status} during extraction`,
      };
    }

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

    // Process each extracted entity
    const now = new Date();
    for (const entity of payload.entities) {
      const entitySlug = slugify(entity.name);

      // Upsert entity (create if not exists, update lastSeen if exists)
      const upsertedEntity = await tx.entity.upsert({
        where: {
          name_type: {
            name: entity.name,
            type: entity.type,
          },
        },
        create: {
          name: entity.name,
          slug: entitySlug,
          type: entity.type,
          firstSeen: now,
          lastSeen: now,
        },
        update: {
          lastSeen: now,
        },
      });

      // Create entity mention
      await tx.entityMention.create({
        data: {
          eventId,
          entityId: upsertedEntity.id,
          role: entity.role,
          confidence: entity.confidence,
        },
      });

      log(`Upserted entity ${entity.name} (${entity.type}) with mention role ${entity.role}`);
    }

    // Create artifact
    await tx.eventArtifact.create({
      data: {
        eventId,
        artifactType: "ENTITY_EXTRACT",
        version: 1,
        payload: payload as unknown as object,
        modelUsed: client.model,
        promptVersion: PROMPT_VERSION,
        promptHash,
        inputHash,
        runId,
      },
    });

    log(`Event ${eventId} entity extraction complete: ${payload.entities.length} entities`);

    return {
      success: true,
      eventId,
      entitiesExtracted: payload.entities.length,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process an entity extract job from the queue.
 *
 * @param job - The BullMQ job containing event data
 */
export async function processEntityExtract(
  job: Job<EntityExtractJob>
): Promise<EntityExtractResult> {
  const { eventId } = job.data;

  log(`Processing entity extraction for ${eventId}`);

  // Get LLM client from environment
  const { createDefaultLLMClient } = await import("@genai/llm");
  const client = createDefaultLLMClient();

  return extractEntities({ eventId }, client);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for entity extraction processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createEntityExtractWorker(connection: ConnectionOptions): Worker {
  return new Worker("entity-extract", processEntityExtract, {
    connection,
  });
}
