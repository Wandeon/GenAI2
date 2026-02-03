import type { Job } from "bullmq";

// ============================================================================
// EVENT ENRICH PROCESSOR
// ============================================================================
// Enriches events with GM-generated artifacts
// Implements Architecture Constitution #3, #8, #9

export interface EventEnrichJob {
  eventId: string;
}

export async function processEventEnrich(
  job: Job<EventEnrichJob>
): Promise<void> {
  const { eventId } = job.data;

  console.log(`Enriching event ${eventId}`);

  // TODO: Implement in Phase 2
  // 1. Load Event with evidence snapshots
  // 2. For each artifact type needed:
  //    a. Build input from evidence
  //    b. Call GMService.generateArtifact()
  //    c. Store EventArtifact with typed payload
  //    d. Log LLMRun with tokens, cost, latency
  // 3. Update Event status: RAW → ENRICHED
  // 4. Create EventStatusChange audit log
  // 5. Emit entity-extract and topic-assign jobs

  console.log(`Event ${eventId} enriched`);
}
