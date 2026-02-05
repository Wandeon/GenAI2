import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { ingestFeeds } from "./triggers/feed-ingest";

// ============================================================================
// WORKER ENTRY POINT - Event-driven pipeline orchestration
// ============================================================================
// Implements Architecture Constitution #6: Event-driven pipelines
// New data → emit event → processors react
// Cron only for heartbeats, not primary scheduling
//
// Pipeline Flow:
// evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match

// Import processor worker factories
import { createEvidenceSnapshotWorker } from "./processors/evidence-snapshot";
import { createEventCreateWorker } from "./processors/event-create";
import { createEventEnrichWorker } from "./processors/event-enrich";
import { createEntityExtractWorker } from "./processors/entity-extract";
import { createTopicAssignWorker } from "./processors/topic-assign";
import { createRelationshipExtractWorker } from "./processors/relationship-extract";
import { createWatchlistMatchWorker } from "./processors/watchlist-match";
import { createEventClusterWorker } from "./processors/event-cluster";
import { createConfidenceScoreWorker } from "./processors/confidence-score";
import { createDailyBriefingWorker } from "./processors/daily-briefing";

// Import job types for type safety
import type { EvidenceSnapshotJob, EvidenceSnapshotResult } from "./processors/evidence-snapshot";
import type { EventCreateJob, EventCreateResult } from "./processors/event-create";
import type { EventEnrichJob, EventEnrichResult } from "./processors/event-enrich";
import type { EntityExtractJob, EntityExtractResult } from "./processors/entity-extract";
import type { TopicAssignJob, TopicAssignResult } from "./processors/topic-assign";
import type { RelationshipExtractJob, RelationshipExtractResult } from "./processors/relationship-extract";
import type { WatchlistMatchJob } from "./processors/watchlist-match";
import type { EventClusterJob, EventClusterResult } from "./processors/event-cluster";
import type { ConfidenceScoreJob, ConfidenceScoreResult } from "./processors/confidence-score";
import type { DailyBriefingJob } from "./processors/daily-briefing";

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
  eventCluster: new Queue<EventClusterJob>("event-cluster", { connection }),
  eventCreate: new Queue<EventCreateJob>("event-create", { connection }),
  confidenceScore: new Queue<ConfidenceScoreJob>("confidence-score", { connection }),
  eventEnrich: new Queue<EventEnrichJob>("event-enrich", { connection }),
  entityExtract: new Queue<EntityExtractJob>("entity-extract", { connection }),
  topicAssign: new Queue<TopicAssignJob>("topic-assign", { connection }),
  relationshipExtract: new Queue<RelationshipExtractJob>("relationship-extract", { connection }),
  watchlistMatch: new Queue<WatchlistMatchJob>("watchlist-match", { connection }),
  dailyBriefing: new Queue<DailyBriefingJob>("daily-briefing", { connection }),
  feedIngest: new Queue("feed-ingest", { connection }),
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

// 1. Evidence Snapshot Worker - on completion, enqueue event-create
const evidenceSnapshotWorker = createEvidenceSnapshotWorker(connection);
evidenceSnapshotWorker.on("completed", async (job: Job<EvidenceSnapshotJob>, result: EvidenceSnapshotResult) => {
  if (!result?.snapshotId || !job.data.title) {
    log(`evidence-snapshot completed for ${job.data.url} but missing data, skipping event-cluster`);
    return;
  }
  log(`evidence-snapshot completed for ${job.data.url}, enqueueing event-cluster`);
  await queues.eventCluster.add("cluster", {
    snapshotId: result.snapshotId,
    sourceType: job.data.sourceType,
    sourceId: job.data.sourceId,
    title: job.data.title,
    publishedAt: job.data.publishedAt || new Date().toISOString(),
  });
});
workers.push(evidenceSnapshotWorker);

// 2. Event Cluster Worker - on completion, enqueue event-create
const eventClusterWorker = createEventClusterWorker(connection);
eventClusterWorker.on("completed", async (_job: Job<EventClusterJob>, result: EventClusterResult) => {
  if ((result.decision as string) === "skipped") {
    log(`event-cluster skipped for ${result.snapshotId} (already linked)`);
    return;
  }
  log(`event-cluster ${result.decision} for ${result.snapshotId}, enqueueing event-create`);
  await queues.eventCreate.add("create", {
    snapshotId: result.snapshotId,
    sourceType: result.sourceType,
    sourceId: result.sourceId,
    title: result.title,
    occurredAt: result.publishedAt || new Date().toISOString(),
    matchedEventId: result.matchedEventId ?? undefined,
  });
});
workers.push(eventClusterWorker);

// 3. Event Create Worker - on completion, enqueue confidence-score
const eventCreateWorker = createEventCreateWorker(connection);
eventCreateWorker.on("completed", async (_job: Job<EventCreateJob>, result: EventCreateResult) => {
  if (result && result.eventId) {
    log(`event-create completed for ${result.eventId}, enqueueing confidence-score`);
    await queues.confidenceScore.add("score", { eventId: result.eventId });
  }
});
workers.push(eventCreateWorker);

// 4. Confidence Score Worker - on completion, enqueue event-enrich
const confidenceScoreWorker = createConfidenceScoreWorker(connection);
confidenceScoreWorker.on("completed", async (_job: Job<ConfidenceScoreJob>, result: ConfidenceScoreResult) => {
  if (result && result.eventId) {
    log(`confidence-score completed for ${result.eventId}: ${result.confidence}, enqueueing event-enrich`);
    await queues.eventEnrich.add("enrich", { eventId: result.eventId });
  }
});
workers.push(confidenceScoreWorker);

// 5. Event Enrich Worker - on completion, enqueue entity-extract AND topic-assign in parallel
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

// 6. Entity Extract Worker - on completion, check if topic-assign is done too
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

// 7. Topic Assign Worker - on completion, check if entity-extract is done too
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

// 8. Relationship Extract Worker - on completion, enqueue watchlist-match
const relationshipExtractWorker = createRelationshipExtractWorker(connection);
relationshipExtractWorker.on("completed", async (_job: Job<RelationshipExtractJob>, result: RelationshipExtractResult) => {
  if (result && result.eventId) {
    log(`relationship-extract completed for ${result.eventId}, enqueueing watchlist-match`);
    await queues.watchlistMatch.add("match", { eventId: result.eventId });
  }
});
workers.push(relationshipExtractWorker);

// 9. Watchlist Match Worker - final step in pipeline
const watchlistMatchWorker = createWatchlistMatchWorker(connection);
watchlistMatchWorker.on("completed", async (job: Job<WatchlistMatchJob>) => {
  log(`watchlist-match completed for ${job.data.eventId} - pipeline complete`);
});
workers.push(watchlistMatchWorker);

// 10. Daily Briefing Worker - standalone, triggered by cron at 06:00 CET
const dailyBriefingWorker = createDailyBriefingWorker(connection);
dailyBriefingWorker.on("completed", async (job: Job<DailyBriefingJob>) => {
  log(`daily-briefing completed for ${job.data.date}`);
});
workers.push(dailyBriefingWorker);

// 11. Feed Ingest Worker - fetches from all 11 sources, enqueues evidence-snapshot jobs
const feedIngestWorker = new Worker(
  "feed-ingest",
  async () => {
    log("Feed ingest triggered, fetching from all sources...");
    const count = await ingestFeeds(redisUrl);
    log(`Feed ingest complete: ${count} items enqueued`);
    return { count };
  },
  { connection }
);
feedIngestWorker.on("completed", async (_job, result) => {
  log(`feed-ingest completed: ${result?.count ?? 0} items`);
});
workers.push(feedIngestWorker);

// ============================================================================
// SCHEDULED / REPEATABLE JOBS
// ============================================================================

async function setupRepeatableJobs() {
  // Feed ingest: every 2 hours
  await queues.feedIngest.upsertJobScheduler(
    "feed-ingest-schedule",
    { pattern: "0 */2 * * *" },
    { name: "scheduled-ingest" }
  );
  log("Scheduled feed-ingest: every 2 hours (0 */2 * * *)");

  // Daily briefing: 05:00 UTC = 06:00 CET
  await queues.dailyBriefing.upsertJobScheduler(
    "daily-briefing-schedule",
    { pattern: "0 5 * * *" },
    {
      name: "scheduled-briefing",
      data: { date: new Date().toISOString().slice(0, 10) },
    }
  );
  log("Scheduled daily-briefing: 05:00 UTC (06:00 CET)");
}

setupRepeatableJobs().catch((err) => {
  log(`Failed to setup repeatable jobs: ${err instanceof Error ? err.message : String(err)}`);
});

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
log("Pipeline: evidence-snapshot → event-cluster → event-create → confidence-score → event-enrich → (entity-extract + topic-assign) → relationship-extract → watchlist-match");

// Export for testing
export { connection, workers };
