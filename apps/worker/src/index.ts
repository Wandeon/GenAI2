import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";

// ============================================================================
// WORKER ENTRY POINT - Event-driven pipeline orchestration
// ============================================================================
// Implements Architecture Constitution #6: Event-driven pipelines
// New data → emit event → processors react
// Cron only for heartbeats, not primary scheduling
//
// Pipeline Flow:
// evidence-snapshot → event-create → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match

// Import processor worker factories
import { createEvidenceSnapshotWorker } from "./processors/evidence-snapshot";
import { createEventCreateWorker } from "./processors/event-create";
import { createEventEnrichWorker } from "./processors/event-enrich";
import { createEntityExtractWorker } from "./processors/entity-extract";
import { createTopicAssignWorker } from "./processors/topic-assign";
import { createRelationshipExtractWorker } from "./processors/relationship-extract";
import { createWatchlistMatchWorker } from "./processors/watchlist-match";

// Import job types for type safety
import type { EvidenceSnapshotJob } from "./processors/evidence-snapshot";
import type { EventCreateJob, EventCreateResult } from "./processors/event-create";
import type { EventEnrichJob, EventEnrichResult } from "./processors/event-enrich";
import type { EntityExtractJob, EntityExtractResult } from "./processors/entity-extract";
import type { TopicAssignJob, TopicAssignResult } from "./processors/topic-assign";
import type { RelationshipExtractJob, RelationshipExtractResult } from "./processors/relationship-extract";
import type { WatchlistMatchJob } from "./processors/watchlist-match";

// ============================================================================
// LOGGING
// ============================================================================

function log(message: string): void {
  process.env.NODE_ENV !== "test" && console.log(`[worker-index] ${message}`);
}

// ============================================================================
// CONNECTION SETUP
// ============================================================================

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

log(`Connecting to Redis at ${redisUrl}`);

// ============================================================================
// QUEUE DEFINITIONS
// ============================================================================

// Define queues for each processing stage
export const queues = {
  evidenceSnapshot: new Queue<EvidenceSnapshotJob>("evidence-snapshot", { connection }),
  eventCreate: new Queue<EventCreateJob>("event-create", { connection }),
  eventEnrich: new Queue<EventEnrichJob>("event-enrich", { connection }),
  entityExtract: new Queue<EntityExtractJob>("entity-extract", { connection }),
  topicAssign: new Queue<TopicAssignJob>("topic-assign", { connection }),
  relationshipExtract: new Queue<RelationshipExtractJob>("relationship-extract", { connection }),
  watchlistMatch: new Queue<WatchlistMatchJob>("watchlist-match", { connection }),
} as const;

// ============================================================================
// PARALLEL COMPLETION TRACKING
// ============================================================================

// Track completion of parallel processors (entity-extract and topic-assign)
// Both must complete before relationship-extract can run
const parallelCompletions = new Map<string, { entityDone: boolean; topicDone: boolean }>();

function checkAndTriggerRelationshipExtract(eventId: string): boolean {
  const state = parallelCompletions.get(eventId);
  if (state && state.entityDone && state.topicDone) {
    parallelCompletions.delete(eventId);
    return true;
  }
  return false;
}

function markEntityDone(eventId: string): void {
  const state = parallelCompletions.get(eventId) || { entityDone: false, topicDone: false };
  state.entityDone = true;
  parallelCompletions.set(eventId, state);
}

function markTopicDone(eventId: string): void {
  const state = parallelCompletions.get(eventId) || { entityDone: false, topicDone: false };
  state.topicDone = true;
  parallelCompletions.set(eventId, state);
}

// ============================================================================
// WORKER CREATION WITH PIPELINE WIRING
// ============================================================================

// Create workers for all processors
const workers: Worker[] = [];

// 1. Evidence Snapshot Worker
const evidenceSnapshotWorker = createEvidenceSnapshotWorker(connection);
workers.push(evidenceSnapshotWorker);

// 2. Event Create Worker - on completion, enqueue event-enrich
const eventCreateWorker = createEventCreateWorker(connection);
eventCreateWorker.on("completed", async (_job: Job<EventCreateJob>, result: EventCreateResult) => {
  if (result && result.eventId) {
    log(`event-create completed for ${result.eventId}, enqueueing event-enrich`);
    await queues.eventEnrich.add("enrich", { eventId: result.eventId });
  }
});
workers.push(eventCreateWorker);

// 3. Event Enrich Worker - on completion, enqueue entity-extract AND topic-assign in parallel
const eventEnrichWorker = createEventEnrichWorker(connection);
eventEnrichWorker.on("completed", async (_job: Job<EventEnrichJob>, result: EventEnrichResult) => {
  if (result && result.success && !result.skipped && result.eventId) {
    log(`event-enrich completed for ${result.eventId}, enqueueing entity-extract and topic-assign`);
    // Initialize parallel tracking for this event
    parallelCompletions.set(result.eventId, { entityDone: false, topicDone: false });
    // Enqueue both processors in parallel
    await Promise.all([
      queues.entityExtract.add("extract", { eventId: result.eventId }),
      queues.topicAssign.add("assign", { eventId: result.eventId }),
    ]);
  }
});
workers.push(eventEnrichWorker);

// 4. Entity Extract Worker - on completion, check if topic-assign is done too
const entityExtractWorker = createEntityExtractWorker(connection);
entityExtractWorker.on("completed", async (_job: Job<EntityExtractJob>, result: EntityExtractResult) => {
  if (result && result.eventId) {
    log(`entity-extract completed for ${result.eventId}`);
    markEntityDone(result.eventId);
    if (checkAndTriggerRelationshipExtract(result.eventId)) {
      log(`Both entity-extract and topic-assign done for ${result.eventId}, enqueueing relationship-extract`);
      await queues.relationshipExtract.add("extract", { eventId: result.eventId });
    }
  }
});
workers.push(entityExtractWorker);

// 5. Topic Assign Worker - on completion, check if entity-extract is done too
const topicAssignWorker = createTopicAssignWorker(connection);
topicAssignWorker.on("completed", async (_job: Job<TopicAssignJob>, result: TopicAssignResult) => {
  if (result && result.eventId) {
    log(`topic-assign completed for ${result.eventId}`);
    markTopicDone(result.eventId);
    if (checkAndTriggerRelationshipExtract(result.eventId)) {
      log(`Both entity-extract and topic-assign done for ${result.eventId}, enqueueing relationship-extract`);
      await queues.relationshipExtract.add("extract", { eventId: result.eventId });
    }
  }
});
workers.push(topicAssignWorker);

// 6. Relationship Extract Worker - on completion, enqueue watchlist-match
const relationshipExtractWorker = createRelationshipExtractWorker(connection);
relationshipExtractWorker.on("completed", async (_job: Job<RelationshipExtractJob>, result: RelationshipExtractResult) => {
  if (result && result.eventId) {
    log(`relationship-extract completed for ${result.eventId}, enqueueing watchlist-match`);
    await queues.watchlistMatch.add("match", { eventId: result.eventId });
  }
});
workers.push(relationshipExtractWorker);

// 7. Watchlist Match Worker - final step in pipeline
const watchlistMatchWorker = createWatchlistMatchWorker(connection);
watchlistMatchWorker.on("completed", async (job: Job<WatchlistMatchJob>) => {
  log(`watchlist-match completed for ${job.data.eventId} - pipeline complete`);
});
workers.push(watchlistMatchWorker);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Add error handlers to all workers
workers.forEach((worker) => {
  worker.on("failed", (job, err) => {
    log(`Job ${job?.id} in ${worker.name} failed: ${err.message}`);
  });
  worker.on("error", (err) => {
    log(`Worker ${worker.name} error: ${err.message}`);
  });
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown() {
  log("Shutting down workers...");

  // Close all workers
  await Promise.all(workers.map((w) => w.close()));

  // Close all queues
  await Promise.all(Object.values(queues).map((q) => q.close()));

  // Close Redis connection
  await connection.quit();

  log("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// STARTUP
// ============================================================================

log(`Worker started with ${workers.length} processors`);
log("Pipeline: evidence-snapshot → event-create → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match");

// Export for testing
export { connection, workers };
