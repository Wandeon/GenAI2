import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { hashString } from "@genai/llm";
import { RelationshipExtractPayload } from "@genai/shared/schemas/artifacts";
import {
  validateRelationship,
  type TrustTier,
  type RelationType,
} from "@genai/shared/graph-safety";

// Local imports
import type {
  RelationshipExtractJob,
  RelationshipExtractInput,
  RelationshipExtractResult,
  EventWithEntities,
  ExtractedRelationship,
} from "./relationship-extract.types";
import {
  PROCESSOR_NAME,
  PROMPT_VERSION,
  log,
  buildEvidenceText,
  buildEntityList,
  calculateCost,
  RELATIONSHIP_EXTRACT_PROMPT,
} from "./relationship-extract.utils";

// Re-export types for external consumers
export type {
  RelationshipExtractJob,
  RelationshipExtractInput,
  RelationshipExtractResult,
} from "./relationship-extract.types";

// ============================================================================
// RELATIONSHIP EXTRACT PROCESSOR
// ============================================================================
// Extracts relationships between entities using LLM
// Implements Architecture Constitution #3, #7, #8, #9
//
// #3: STRUCTURED OVER TEXT - Relationship payloads are typed JSON
// #7: SAFETY GATES ON RELATIONSHIPS - High-risk claims require verification
// #8: GM AS VERSIONED SERVICE - Outputs are artifacts with version, model, prompt hash
// #9: OBSERVABILITY BUILT-IN - Every LLM call logs model, tokens, cost, latency

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the highest trust tier from evidence sources.
 */
function getHighestTrustTier(event: EventWithEntities): TrustTier {
  const tiers: TrustTier[] = event.evidence.map((ev) => ev.snapshot.source.trustTier);
  if (tiers.includes("AUTHORITATIVE")) return "AUTHORITATIVE";
  if (tiers.includes("STANDARD")) return "STANDARD";
  return "LOW";
}

/**
 * Find entity ID by name from mentions.
 */
function findEntityId(
  entityName: string,
  mentions: EventWithEntities["mentions"]
): string | null {
  const mention = mentions.find((m) => m.entity.name === entityName);
  return mention ? mention.entity.id : null;
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Extract relationships from an event with entity mentions.
 *
 * This function:
 * 1. Loads the event with its entity mentions
 * 2. Skips if fewer than 2 entities (no relationships possible)
 * 3. Uses LLM to extract relationships
 * 4. Applies safety gate validation to each relationship
 * 5. Creates Relationship records with status from safety gate
 * 6. Creates RELATIONSHIP_EXTRACT artifact
 * 7. Logs LLM run for cost tracking
 *
 * @param input - The extraction input with eventId
 * @param client - LLM client to use for extraction
 * @returns Result with relationships extracted count
 */
export async function extractRelationships(
  input: RelationshipExtractInput,
  client: LLMClient
): Promise<RelationshipExtractResult> {
  const { eventId } = input;

  log(`Starting relationship extraction for event ${eventId}`);

  return prisma.$transaction(async (tx) => {
    // Load event with mentions and evidence
    const event = (await tx.event.findUnique({
      where: { id: eventId },
      include: {
        evidence: {
          include: {
            snapshot: {
              include: {
                source: true,
              },
            },
          },
        },
        mentions: {
          include: {
            entity: true,
          },
        },
      },
    })) as EventWithEntities | null;

    // Check if event exists
    if (!event) {
      log(`Event ${eventId} not found`);
      return {
        success: false,
        eventId,
        relationshipsExtracted: 0,
        error: `Event ${eventId} not found`,
      };
    }

    // Check status - only process ENRICHED events
    if (event.status !== "ENRICHED") {
      log(`Event ${eventId} not in ENRICHED status (current: ${event.status}), skipping`);
      return {
        success: true,
        eventId,
        relationshipsExtracted: 0,
        skipped: true,
        skipReason: `Event not in ENRICHED status (current: ${event.status})`,
      };
    }

    // Check if we have enough entities
    if (event.mentions.length < 2) {
      log(`Event ${eventId} has fewer than 2 entities, skipping relationship extraction`);
      return {
        success: true,
        eventId,
        relationshipsExtracted: 0,
        skipped: true,
        skipReason: "Fewer than 2 entities - no relationships possible",
      };
    }

    // Build context for LLM
    const evidenceText = buildEvidenceText(event.evidence);
    const entityList = buildEntityList(event.mentions);

    // Build prompt
    const prompt = RELATIONSHIP_EXTRACT_PROMPT(event.title, evidenceText, entityList);
    const promptHash = hashString(prompt);
    const inputHash = hashString(evidenceText + entityList);

    // Call LLM and measure latency
    log(`Calling LLM to extract relationships for event ${eventId}`);
    const startTime = Date.now();
    let response: LLMResponse;
    try {
      response = await client.complete(prompt);
    } catch (error) {
      log(`LLM call failed for relationship extraction: ${error}`);
      throw error;
    }
    const latencyMs = Date.now() - startTime;

    // Parse and validate response
    let payload: { relationships: ExtractedRelationship[] };
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
      payload = RelationshipExtractPayload.parse(parsed);
    } catch (error) {
      log(`Failed to parse relationship extraction response: ${error}`);
      throw new Error(
        `Failed to parse relationship extraction response: ${error instanceof Error ? error.message : String(error)}`
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

    // Get safety context
    const trustTier = getHighestTrustTier(event);
    const sourceCount = event.evidence.length;
    const now = new Date();

    // Process each extracted relationship
    let relationshipsCreated = 0;
    for (const rel of payload.relationships) {
      // Find entity IDs
      const sourceId = findEntityId(rel.sourceEntity, event.mentions);
      const targetId = findEntityId(rel.targetEntity, event.mentions);

      if (!sourceId || !targetId) {
        log(`Skipping relationship ${rel.sourceEntity} -> ${rel.targetEntity}: entity not found`);
        continue;
      }

      // Apply safety gate
      const safetyResult = validateRelationship(
        {
          sourceEntity: rel.sourceEntity,
          targetEntity: rel.targetEntity,
          type: rel.type as RelationType,
          eventId,
          modelConfidence: rel.confidence,
        },
        trustTier,
        sourceCount
      );

      // Create relationship record
      await tx.relationship.create({
        data: {
          sourceId,
          targetId,
          type: rel.type,
          eventId,
          status: safetyResult.status,
          statusReason: safetyResult.reason,
          modelConfidence: rel.confidence,
          occurredAt: event.occurredAt,
          validatedAt: now,
        },
      });

      log(
        `Created relationship ${rel.sourceEntity} -[${rel.type}]-> ${rel.targetEntity} with status ${safetyResult.status}`
      );
      relationshipsCreated++;
    }

    // Create artifact
    await tx.eventArtifact.create({
      data: {
        eventId,
        artifactType: "RELATIONSHIP_EXTRACT",
        version: 1,
        payload: payload as unknown as object,
        modelUsed: client.model,
        promptVersion: PROMPT_VERSION,
        promptHash,
        inputHash,
        runId,
      },
    });

    log(`Event ${eventId} relationship extraction complete: ${relationshipsCreated} relationships`);

    return {
      success: true,
      eventId,
      relationshipsExtracted: relationshipsCreated,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process a relationship extract job from the queue.
 *
 * @param job - The BullMQ job containing event data
 */
export async function processRelationshipExtract(
  job: Job<RelationshipExtractJob>
): Promise<RelationshipExtractResult> {
  const { eventId } = job.data;

  log(`Processing relationship extraction for ${eventId}`);

  // Get LLM client from environment
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }

  // Import dynamically to avoid circular dependencies
  const { createGeminiClient } = await import("@genai/llm");
  const client = createGeminiClient(apiKey);

  return extractRelationships({ eventId }, client);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for relationship extraction processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createRelationshipExtractWorker(connection: ConnectionOptions): Worker {
  return new Worker("relationship-extract", processRelationshipExtract, {
    connection,
  });
}
