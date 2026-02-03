import type { Job } from "bullmq";

// ============================================================================
// EVENT CREATE PROCESSOR
// ============================================================================
// Creates events with fingerprint-based deduplication
// Implements Architecture Constitution #2: Append-only state machine

export interface EventCreateJob {
  snapshotId: string;
  sourceType: string;
  sourceId: string;
}

export async function processEventCreate(
  job: Job<EventCreateJob>
): Promise<void> {
  const { snapshotId, sourceType, sourceId } = job.data;

  console.log(`Creating event from snapshot ${snapshotId}`);

  // TODO: Implement in Phase 2
  // 1. Load EvidenceSnapshot
  // 2. Extract event data (title, occurredAt)
  // 3. Generate fingerprint (hash of normalized title + date + primary entities)
  // 4. Check for duplicate by fingerprint
  //    - If duplicate: link evidence to existing event
  //    - If new: create Event with status=RAW
  // 5. Create EventStatusChange audit log entry
  // 6. Create EventEvidence link (snapshotId, role=PRIMARY)
  // 7. Emit event-enrich job

  console.log(`Event created for ${sourceType}:${sourceId}`);
}
