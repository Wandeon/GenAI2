import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";

// ============================================================================
// WORKER ENTRY POINT - Event-driven pipeline orchestration
// ============================================================================
// Implements Architecture Constitution #6: Event-driven pipelines
// New data → emit event → processors react
// Cron only for heartbeats, not primary scheduling

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Define queues for each processing stage
export const queues = {
  evidenceSnapshot: new Queue("evidence-snapshot", { connection }),
  eventCreate: new Queue("event-create", { connection }),
  eventEnrich: new Queue("event-enrich", { connection }),
  entityExtract: new Queue("entity-extract", { connection }),
  relationshipExtract: new Queue("relationship-extract", { connection }),
  topicAssign: new Queue("topic-assign", { connection }),
  watchlistMatch: new Queue("watchlist-match", { connection }),
} as const;

// Import processors (placeholder implementations)
import { processEvidenceSnapshot } from "./processors/evidence-snapshot";
import { processEventCreate } from "./processors/event-create";
import { processEventEnrich } from "./processors/event-enrich";

// Create workers
const workers = [
  new Worker("evidence-snapshot", processEvidenceSnapshot, { connection }),
  new Worker("event-create", processEventCreate, { connection }),
  new Worker("event-enrich", processEventEnrich, { connection }),
  // TODO: Add remaining workers in Phase 2
];

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`Worker started with ${workers.length} processors`);
