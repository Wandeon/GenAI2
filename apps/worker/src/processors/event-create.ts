import crypto from "crypto";
import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma, SourceType, ImpactLevel } from "@genai/db";

// ============================================================================
// EVENT CREATE PROCESSOR
// ============================================================================
// Creates events with fingerprint-based deduplication
// Implements Architecture Constitution #2: Append-only state machine

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EventCreateJob {
  snapshotId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  titleHr?: string;
  occurredAt: string; // ISO date string from queue
  impactLevel?: string;
}

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

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for event-create processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[event-create] ${message}`);
}

// ============================================================================
// FINGERPRINT GENERATION
// ============================================================================

/**
 * Normalize a title for fingerprint generation.
 *
 * - Converts to lowercase
 * - Trims whitespace
 * - Collapses multiple spaces to single space
 *
 * @param title - The title to normalize
 * @returns Normalized title
 */
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Generate a fingerprint for event deduplication.
 *
 * Format: SHA-256 of "sourceType:YYYY-MM-DD:normalizedTitle"
 * Returns first 32 characters of hex hash.
 *
 * This ensures that events from the same source type on the same day
 * with semantically identical titles are deduplicated.
 *
 * @param title - The event title
 * @param occurredAt - When the event occurred
 * @param sourceType - The type of source (e.g., "NEWSAPI", "HN")
 * @returns 32-character hex fingerprint
 */
export function generateFingerprint(
  title: string,
  occurredAt: Date,
  sourceType: string
): string {
  const normalizedTitle = normalizeTitle(title);
  const dateStr = occurredAt.toISOString().slice(0, 10); // YYYY-MM-DD
  const input = `${sourceType}:${dateStr}:${normalizedTitle}`;

  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Create an Event with fingerprint-based deduplication.
 *
 * This function:
 * 1. Generates a fingerprint from title, date, and source type
 * 2. Checks if an event with this fingerprint already exists
 * 3. If new: creates Event + PRIMARY evidence link + status change (in transaction)
 * 4. If duplicate: adds SUPPORTING evidence link to existing event
 *
 * All operations are wrapped in a Prisma transaction for atomicity.
 *
 * @param input - The event creation input
 * @returns Result with eventId, created flag, and fingerprint
 */
export async function createEvent(
  input: EventCreateInput
): Promise<EventCreateResult> {
  const { title, titleHr, occurredAt, sourceType, sourceId, snapshotId, impactLevel } =
    input;

  // Generate fingerprint for deduplication
  const fingerprint = generateFingerprint(title, occurredAt, sourceType);

  // Execute all operations in a transaction
  return prisma.$transaction(async (tx) => {
    // Check for existing event with this fingerprint
    const existingEvent = await tx.event.findUnique({
      where: { fingerprint },
    });

    if (existingEvent) {
      // Duplicate found - add supporting evidence
      log(`Duplicate event found: ${existingEvent.id}, adding supporting evidence`);

      await tx.eventEvidence.create({
        data: {
          eventId: existingEvent.id,
          snapshotId,
          role: "SUPPORTING",
        },
      });

      return {
        eventId: existingEvent.id,
        created: false,
        fingerprint: existingEvent.fingerprint,
      };
    }

    // Create new event
    log(`Creating new event with fingerprint: ${fingerprint}`);

    const event = await tx.event.create({
      data: {
        fingerprint,
        title,
        titleHr: titleHr ?? null,
        occurredAt,
        sourceType,
        sourceId,
        status: "RAW",
        impactLevel: impactLevel ?? "MEDIUM",
      },
    });

    // Create primary evidence link
    await tx.eventEvidence.create({
      data: {
        eventId: event.id,
        snapshotId,
        role: "PRIMARY",
      },
    });

    // Create initial status change (audit log)
    await tx.eventStatusChange.create({
      data: {
        eventId: event.id,
        fromStatus: null,
        toStatus: "RAW",
        reason: "Initial creation",
      },
    });

    return {
      eventId: event.id,
      created: true,
      fingerprint,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process an event create job from the queue.
 *
 * @param job - The BullMQ job containing event data
 */
export async function processEventCreate(
  job: Job<EventCreateJob>
): Promise<EventCreateResult> {
  const { snapshotId, sourceType, sourceId, title, titleHr, occurredAt, impactLevel } =
    job.data;

  log(`Processing event create for snapshot ${snapshotId}`);

  const result = await createEvent({
    title,
    titleHr,
    occurredAt: new Date(occurredAt),
    sourceType: sourceType as SourceType,
    sourceId,
    snapshotId,
    impactLevel: impactLevel as ImpactLevel | undefined,
  });

  log(
    `Event ${result.created ? "created" : "deduplicated"}: id=${result.eventId}, fingerprint=${result.fingerprint}`
  );

  return result;
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for event creation processing.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createEventCreateWorker(connection: ConnectionOptions): Worker {
  return new Worker("event-create", processEventCreate, {
    connection,
  });
}
