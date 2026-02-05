import type { Job, ConnectionOptions } from "bullmq";
import { Worker } from "bullmq";
import { prisma } from "@genai/db";
import type { EventStatus } from "@genai/db";
import {
  computeConfidence,
  confidenceToStatus,
} from "@genai/shared/confidence";
import type { TrustTier, EvidenceTrustProfile } from "@genai/shared/confidence";

// ============================================================================
// CONFIDENCE SCORE PROCESSOR
// ============================================================================
// Runs after event-create. Evaluates evidence trust profiles to compute
// a confidence level and apply the publish gate.
//
// Implements Architecture Constitution:
// #1: EVIDENCE FIRST - Confidence derived from evidence chain
// #2: APPEND-ONLY STATE MACHINE - Status transitions follow the defined rules
// #7: SAFETY GATES ON RELATIONSHIPS - High-risk claims need AUTHORITATIVE or 2+ sources

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConfidenceScoreJob {
  eventId: string;
}

export interface ConfidenceScoreResult {
  eventId: string;
  confidence: string;
  sourceCount: number;
  newStatus: string;
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Simple tagged logger for confidence-score processor.
 * Suppresses logs during tests, uses consistent prefix for filtering.
 */
function log(message: string): void {
  process.env.NODE_ENV !== "test" &&
    console.log(`[confidence-score] ${message}`);
}

// ============================================================================
// ARTIFACT COMPLETENESS CHECK
// ============================================================================

const REQUIRED_ARTIFACTS = ["HEADLINE", "SUMMARY", "WHAT_HAPPENED", "WHY_MATTERS"] as const;

/**
 * Check if all required artifacts exist for an event.
 * GM_TAKE is optional and does not block publishing.
 */
async function checkArtifactCompleteness(
  eventId: string
): Promise<{ complete: boolean; missing: string[] }> {
  const artifacts = await prisma.eventArtifact.findMany({
    where: { eventId },
    select: { artifactType: true },
  });

  const existingTypes = new Set(artifacts.map((a) => a.artifactType));
  const missing = REQUIRED_ARTIFACTS.filter((t) => !existingTypes.has(t));

  return { complete: missing.length === 0, missing };
}

// ============================================================================
// STATUS TRANSITION LOGIC
// ============================================================================

/**
 * Determine if a status transition is allowed.
 *
 * Rules:
 * - RAW events can transition to PUBLISHED or QUARANTINED
 * - QUARANTINED events can upgrade to PUBLISHED (confidence improved)
 * - Already-PUBLISHED events are never regressed
 * - ENRICHED/VERIFIED events can transition to PUBLISHED or QUARANTINED
 * - BLOCKED events are never changed by this processor
 */
function shouldTransition(
  currentStatus: EventStatus,
  gateStatus: "PUBLISHED" | "QUARANTINED"
): boolean {
  // Never touch BLOCKED events
  if (currentStatus === "BLOCKED") return false;

  // Never regress PUBLISHED events
  if (currentStatus === "PUBLISHED") return false;

  // Allow upgrade from QUARANTINED to PUBLISHED only
  if (currentStatus === "QUARANTINED") {
    return gateStatus === "PUBLISHED";
  }

  // RAW, ENRICHED, VERIFIED can all transition
  return true;
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Score confidence for an event based on its evidence chain.
 *
 * This function:
 * 1. Loads event with all evidence -> snapshot -> source (for trust tier)
 * 2. Builds EvidenceTrustProfile from evidence
 * 3. Calls computeConfidence() to determine confidence level
 * 4. Applies publish gate via confidenceToStatus()
 * 5. Updates Event.confidence, Event.sourceCount, and Event.status
 * 6. Creates EventStatusChange audit log when transitioning
 *
 * Uses prisma.$transaction for atomicity on status changes.
 *
 * @param eventId - The event to score
 * @returns Scoring result with confidence, sourceCount, and status
 */
export async function scoreConfidence(
  eventId: string
): Promise<ConfidenceScoreResult> {
  log(`Scoring confidence for event ${eventId}`);

  // Load event with full evidence chain
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      evidence: {
        include: {
          snapshot: {
            include: {
              source: {
                select: { trustTier: true },
              },
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  // Build trust profile from evidence chain
  const tiers: TrustTier[] = event.evidence.map(
    (ev) => ev.snapshot.source.trustTier as TrustTier
  );

  const profile: EvidenceTrustProfile = {
    sourceCount: event.evidence.length,
    tiers,
  };

  // Compute confidence and gate status
  const confidence = computeConfidence(profile);
  const gateStatus = confidenceToStatus(confidence);
  const sourceCount = event.evidence.length;

  // Check artifact completeness (required for publish)
  const { complete: artifactsComplete, missing: missingArtifacts } =
    await checkArtifactCompleteness(eventId);

  // If artifacts incomplete, force QUARANTINED regardless of confidence
  const effectiveGateStatus = artifactsComplete ? gateStatus : "QUARANTINED";

  log(
    `Event ${eventId}: ${sourceCount} source(s), tiers=[${tiers.join(",")}], ` +
      `confidence=${confidence}, gate=${effectiveGateStatus}, current=${event.status}` +
      (missingArtifacts.length > 0 ? `, missing=[${missingArtifacts.join(",")}]` : "")
  );

  // Perform atomic update
  return prisma.$transaction(async (tx) => {
    // Re-read status inside transaction to prevent races
    const current = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true },
    });

    if (!current) {
      throw new Error(`Event ${eventId} not found during transaction`);
    }

    const freshStatus = current.status as EventStatus;
    const transitionAllowed = shouldTransition(freshStatus, effectiveGateStatus);
    const newStatus = transitionAllowed ? effectiveGateStatus : freshStatus;

    // Always update cached confidence and sourceCount
    await tx.event.update({
      where: { id: eventId },
      data: {
        confidence,
        sourceCount,
        ...(transitionAllowed ? { status: effectiveGateStatus } : {}),
      },
    });

    // Create audit log entry if status changed
    if (transitionAllowed) {
      await tx.eventStatusChange.create({
        data: {
          eventId,
          fromStatus: freshStatus,
          toStatus: effectiveGateStatus,
          reason:
            `Confidence scoring: ${confidence} (${sourceCount} source(s), ` +
            `tiers: [${tiers.join(", ")}])` +
            (missingArtifacts.length > 0
              ? ` [BLOCKED: missing ${missingArtifacts.join(", ")}]`
              : " [artifacts complete]"),
          changedBy: "confidence-score-processor",
        },
      });

      log(
        `Event ${eventId} transitioned: ${freshStatus} -> ${effectiveGateStatus}`
      );
    } else {
      log(
        `Event ${eventId} status unchanged at ${freshStatus} ` +
          `(gate=${effectiveGateStatus}, transition not allowed)`
      );
    }

    return {
      eventId,
      confidence,
      sourceCount,
      newStatus,
    };
  });
}

// ============================================================================
// BULLMQ JOB PROCESSOR
// ============================================================================

/**
 * Process a confidence score job from the queue.
 *
 * @param job - The BullMQ job containing event data
 * @returns Scoring result
 */
export async function processConfidenceScore(
  job: Job<ConfidenceScoreJob>
): Promise<ConfidenceScoreResult> {
  const { eventId } = job.data;

  log(`Processing confidence score job for event ${eventId}`);

  return scoreConfidence(eventId);
}

// ============================================================================
// WORKER FACTORY
// ============================================================================

/**
 * Create a BullMQ worker for confidence scoring.
 *
 * @param connection - Redis connection options
 * @returns The worker instance
 */
export function createConfidenceScoreWorker(
  connection: ConnectionOptions
): Worker {
  return new Worker("confidence-score", processConfidenceScore, {
    connection,
  });
}
