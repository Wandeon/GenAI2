import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { calculateGeminiCost, hashString } from "@genai/llm";
import { EntityExtractPayload } from "@genai/shared/schemas/artifacts";

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
// TYPE DEFINITIONS
// ============================================================================

export interface EntityExtractJob {
  eventId: string;
}

export interface EntityExtractInput {
  eventId: string;
}

export interface EntityExtractResult {
  success: boolean;
  eventId: string;
  entitiesExtracted: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

interface EvidenceSnapshot {
  id: string;
  title: string | null;
  fullText: string | null;
  publishedAt: Date | null;
}

interface EventEvidence {
  id: string;
  role: string;
  snapshot: EvidenceSnapshot;
}

interface EventWithEvidence {
  id: string;
  title: string;
  titleHr: string | null;
  status: string;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
  evidence: EventEvidence[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROCESSOR_NAME = "entity-extract";
const PROMPT_VERSION = "1.0.0";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for entity-extract processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[entity-extract] ${message}`);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a URL-safe slug from an entity name.
 *
 * @param name - The entity name to slugify
 * @returns A URL-safe slug
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    // Normalize unicode characters (é -> e, ü -> u, etc.)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Replace special characters with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    // Collapse multiple hyphens
    .replace(/-+/g, "-");
}

/**
 * Build evidence text from snapshots for LLM context.
 */
function buildEvidenceText(evidence: EventEvidence[]): string {
  return evidence
    .map((ev) => {
      const snapshot = ev.snapshot;
      const parts = [];
      if (snapshot.title) parts.push(`Title: ${snapshot.title}`);
      if (snapshot.fullText) parts.push(`Content: ${snapshot.fullText}`);
      if (snapshot.publishedAt)
        parts.push(`Published: ${snapshot.publishedAt.toISOString()}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Calculate cost in cents based on provider.
 */
function calculateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  if (provider === "google") {
    return calculateGeminiCost(inputTokens, outputTokens);
  }
  // Default to Gemini pricing for mock/unknown providers
  return calculateGeminiCost(inputTokens, outputTokens);
}

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

const ENTITY_EXTRACT_PROMPT = (title: string, evidenceText: string) => `
You are GM, an AI news curator. Extract all named entities from this news event.

Event title: ${title}

Evidence:
${evidenceText}

Extract entities of these types:
- COMPANY: Companies (OpenAI, Google, Microsoft, etc.)
- LAB: Research labs (DeepMind, FAIR, etc.)
- MODEL: AI models (GPT-5, Claude, Llama, etc.)
- PRODUCT: Products and services (ChatGPT, Copilot, etc.)
- PERSON: People (Sam Altman, Demis Hassabis, etc.)
- REGULATION: Laws and regulations (EU AI Act, etc.)
- DATASET: Datasets (ImageNet, Common Crawl, etc.)
- BENCHMARK: Benchmarks (MMLU, HumanEval, etc.)

Assign roles:
- SUBJECT: Primary actor in the event
- OBJECT: Thing being acted upon
- MENTIONED: Referenced but not central

Provide confidence scores (0.0 to 1.0) based on:
- How clearly the entity is identified
- How central it is to the event

Respond with ONLY a JSON object in this exact format:
{
  "entities": [
    { "name": "OpenAI", "type": "COMPANY", "role": "SUBJECT", "confidence": 0.95 },
    { "name": "GPT-5", "type": "MODEL", "role": "OBJECT", "confidence": 0.9 }
  ]
}
`;

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

    // Call LLM and measure latency
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
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }

  // Import dynamically to avoid circular dependencies
  const { createGeminiClient } = await import("@genai/llm");
  const client = createGeminiClient(apiKey);

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
