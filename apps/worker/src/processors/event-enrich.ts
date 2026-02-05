import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { LLMClient, LLMResponse } from "@genai/llm";
import { calculateGeminiCost, hashString } from "@genai/llm";
import {
  HeadlinePayload,
  SummaryPayload,
  GMTakePayload,
  type ArtifactType,
} from "@genai/shared/schemas/artifacts";

// ============================================================================
// EVENT ENRICH PROCESSOR
// ============================================================================
// Enriches events with GM-generated artifacts
// Implements Architecture Constitution #3, #8, #9
//
// #3: STRUCTURED OVER TEXT - Artifacts store typed JSON payloads
// #8: GM AS VERSIONED SERVICE - Outputs are artifacts with version, model, prompt hash
// #9: OBSERVABILITY BUILT-IN - Every LLM call logs model, tokens, cost, latency

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EventEnrichJob {
  eventId: string;
}

export interface EventEnrichInput {
  eventId: string;
}

export interface EventEnrichResult {
  success: boolean;
  eventId: string;
  artifacts: ArtifactType[];
  totalLLMRuns: number;
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

const PROCESSOR_NAME = "event-enrich";
const PROMPT_VERSION = "1.0.0";

// Artifact types to generate during enrichment
type EnrichmentArtifactType = "HEADLINE" | "SUMMARY" | "GM_TAKE";
const ENRICHMENT_ARTIFACTS: EnrichmentArtifactType[] = ["HEADLINE", "SUMMARY", "GM_TAKE"];

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for event-enrich processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[event-enrich] ${message}`);
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

const PROMPTS = {
  HEADLINE: (title: string, evidenceText: string) => `
You are GM, an AI news curator for Croatian audiences. Generate a bilingual headline for this news event.

Event title: ${title}

Evidence:
${evidenceText}

Requirements:
- Maximum 100 characters per language
- Be informative, not sensationalist
- No clickbait or fake certainty
- Croatian should use proper grammar (preposition "u", not "v")

Respond with ONLY a JSON object in this exact format:
{
  "en": "English headline here",
  "hr": "Croatian headline here"
}
`,

  SUMMARY: (title: string, evidenceText: string) => `
You are GM, an AI news curator for Croatian audiences. Generate a bilingual summary for this news event.

Event title: ${title}

Evidence:
${evidenceText}

Requirements:
- 2-3 sentence summary in each language
- Include 2-5 bullet points highlighting key facts
- Be informative and factual
- Croatian should use proper grammar (preposition "u", not "v")
- Date format: "29. sijecnja 2026."
- Number format: "1.000" (not "1,000")

Respond with ONLY a JSON object in this exact format:
{
  "en": "English summary here",
  "hr": "Croatian summary here",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"]
}
`,

  GM_TAKE: (title: string, evidenceText: string) => `
You are GM, an AI news curator for Croatian audiences. Provide your analysis of this news event.

Event title: ${title}

Evidence:
${evidenceText}

Requirements:
- Provide honest analysis with appropriate confidence level
- Include caveats if evidence is limited or conflicting
- Never claim certainty when evidence is weak
- Never use corporate-speak (revolutionary, game-changing, etc.)
- Mark speculation clearly
- Croatian should use proper grammar

Respond with ONLY a JSON object in this exact format:
{
  "take": "Your analysis in English",
  "takeHr": "Your analysis in Croatian",
  "confidence": "low" | "medium" | "high",
  "caveats": ["Caveat 1 if any", "Caveat 2 if any"]
}
`,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Parse LLM response and validate against schema.
 */
function parseAndValidateResponse<T>(
  content: string,
  artifactType: ArtifactType
): T {
  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = content.trim();
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

  // Validate against schema
  switch (artifactType) {
    case "HEADLINE":
      return HeadlinePayload.parse(parsed) as T;
    case "SUMMARY":
      return SummaryPayload.parse(parsed) as T;
    case "GM_TAKE":
      return GMTakePayload.parse(parsed) as T;
    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }
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
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Enrich an event with GM-generated artifacts.
 *
 * This function:
 * 1. Loads the event with its evidence snapshots
 * 2. Skips if not in RAW status
 * 3. Generates HEADLINE, SUMMARY, and GM_TAKE artifacts
 * 4. Logs LLM runs for cost tracking
 * 5. Updates event status to ENRICHED
 *
 * @param input - The enrichment input with eventId
 * @param client - LLM client to use for generation
 * @returns Result with artifacts created and LLM run count
 */
export async function enrichEvent(
  input: EventEnrichInput,
  client: LLMClient
): Promise<EventEnrichResult> {
  const { eventId } = input;

  log(`Starting enrichment for event ${eventId}`);

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
        artifacts: [],
        totalLLMRuns: 0,
        error: `Event ${eventId} not found`,
      };
    }

    // Check status - only process RAW events
    if (event.status !== "RAW") {
      log(`Event ${eventId} not in RAW status (current: ${event.status}), skipping`);
      return {
        success: true,
        eventId,
        artifacts: [],
        totalLLMRuns: 0,
        skipped: true,
        skipReason: `Event not in RAW status (current: ${event.status})`,
      };
    }

    // Build evidence context
    const evidenceText = buildEvidenceText(event.evidence);

    // Generate artifacts
    const generatedArtifacts: ArtifactType[] = [];
    let llmRunCount = 0;

    for (const artifactType of ENRICHMENT_ARTIFACTS) {
      log(`Generating ${artifactType} artifact for event ${eventId}`);

      // Build prompt
      const promptBuilder = PROMPTS[artifactType] as (title: string, evidenceText: string) => string;
      const prompt = promptBuilder(event.title, evidenceText);
      const promptHash = hashString(prompt);
      const inputHash = hashString(evidenceText);

      // Call LLM and measure latency
      const startTime = Date.now();
      let response: LLMResponse;
      try {
        response = await client.complete(prompt);
      } catch (error) {
        log(`LLM call failed for ${artifactType}: ${error}`);
        throw error;
      }
      const latencyMs = Date.now() - startTime;

      // Parse and validate response
      let payload: unknown;
      try {
        payload = parseAndValidateResponse(response.content, artifactType);
      } catch (error) {
        log(`Failed to parse ${artifactType} response: ${error}`);
        throw new Error(
          `Failed to parse ${artifactType} response: ${error instanceof Error ? error.message : String(error)}`
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

      // Create artifact
      await tx.eventArtifact.create({
        data: {
          eventId,
          artifactType,
          version: 1,
          payload: payload as object,
          modelUsed: client.model,
          promptVersion: PROMPT_VERSION,
          promptHash,
          inputHash,
          runId,
        },
      });

      generatedArtifacts.push(artifactType);
      llmRunCount++;

      log(`Created ${artifactType} artifact for event ${eventId} (cost: ${costCents} cents)`);
    }

    // Update event status to ENRICHED
    await tx.event.update({
      where: { id: eventId },
      data: { status: "ENRICHED" },
    });

    // Create status change record
    await tx.eventStatusChange.create({
      data: {
        eventId,
        fromStatus: "RAW",
        toStatus: "ENRICHED",
        reason: `Completed enrichment with ${generatedArtifacts.length} artifacts`,
      },
    });

    log(`Event ${eventId} enriched successfully with ${generatedArtifacts.length} artifacts`);

    return {
      success: true,
      eventId,
      artifacts: generatedArtifacts,
      totalLLMRuns: llmRunCount,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process an event enrich job from the queue.
 *
 * @param job - The BullMQ job containing event data
 */
export async function processEventEnrich(
  job: Job<EventEnrichJob>
): Promise<EventEnrichResult> {
  const { eventId } = job.data;

  log(`Processing event enrich for ${eventId}`);

  // Get LLM client from environment
  const { createDefaultLLMClient } = await import("@genai/llm");
  const client = createDefaultLLMClient();

  return enrichEvent({ eventId }, client);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for event enrichment processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createEventEnrichWorker(connection: ConnectionOptions): Worker {
  return new Worker("event-enrich", processEventEnrich, {
    connection,
  });
}
