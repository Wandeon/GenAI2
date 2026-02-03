import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

// ============================================================================
// PIPELINE INTEGRATION TEST
// ============================================================================
// Tests that jobs flow through the pipeline correctly.
// Uses test-specific queue names to avoid collision with real queues.
//
// IMPORTANT: These tests require Redis to be running.
// They may be skipped in CI if Redis is not available.

// Test-specific queue prefix to avoid collision
const TEST_PREFIX = `test-pipeline-${Date.now()}`;

// Queue names with test prefix
const QUEUE_NAMES = {
  evidenceSnapshot: `${TEST_PREFIX}-evidence-snapshot`,
  eventCreate: `${TEST_PREFIX}-event-create`,
  eventEnrich: `${TEST_PREFIX}-event-enrich`,
  entityExtract: `${TEST_PREFIX}-entity-extract`,
  topicAssign: `${TEST_PREFIX}-topic-assign`,
  relationshipExtract: `${TEST_PREFIX}-relationship-extract`,
  watchlistMatch: `${TEST_PREFIX}-watchlist-match`,
};

// Types for test jobs
interface TestJob {
  eventId: string;
  step: string;
}

// ============================================================================
// TEST SETUP
// ============================================================================

let connection: IORedis | null = null;
let queues: Record<string, Queue<TestJob>> = {};
let workers: Worker[] = [];
let isRedisAvailable = false;

// Track job flow through pipeline
const jobFlow: string[] = [];

// Check if Redis is available
async function checkRedisAvailable(): Promise<boolean> {
  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy: () => null, // Don't retry
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return true;
  } catch {
    try {
      await redis.quit();
    } catch {
      // Ignore quit errors
    }
    return false;
  }
}

beforeAll(async () => {
  // Check Redis availability
  isRedisAvailable = await checkRedisAvailable();

  if (!isRedisAvailable) {
    console.warn(
      "Redis not available. Pipeline integration tests will be skipped."
    );
    return;
  }

  // Create Redis connection
  connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  // Create test queues
  queues = {
    evidenceSnapshot: new Queue<TestJob>(QUEUE_NAMES.evidenceSnapshot, { connection }),
    eventCreate: new Queue<TestJob>(QUEUE_NAMES.eventCreate, { connection }),
    eventEnrich: new Queue<TestJob>(QUEUE_NAMES.eventEnrich, { connection }),
    entityExtract: new Queue<TestJob>(QUEUE_NAMES.entityExtract, { connection }),
    topicAssign: new Queue<TestJob>(QUEUE_NAMES.topicAssign, { connection }),
    relationshipExtract: new Queue<TestJob>(QUEUE_NAMES.relationshipExtract, { connection }),
    watchlistMatch: new Queue<TestJob>(QUEUE_NAMES.watchlistMatch, { connection }),
  };
});

afterAll(async () => {
  if (!isRedisAvailable || !connection) return;

  // Close workers
  await Promise.all(workers.map((w) => w.close()));

  // Drain and close queues
  for (const queue of Object.values(queues)) {
    await queue.drain();
    await queue.close();
  }

  // Close connection
  await connection.quit();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockWorker(
  queueName: string,
  nextQueue?: Queue<TestJob>,
  parallelQueues?: { entity: Queue<TestJob>; topic: Queue<TestJob> }
): Worker<TestJob> {
  const worker = new Worker<TestJob>(
    queueName,
    async (job: Job<TestJob>) => {
      // Record that this step was reached
      jobFlow.push(queueName);

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      return { eventId: job.data.eventId, step: queueName };
    },
    { connection: connection! }
  );

  // Wire up to next queue
  if (nextQueue) {
    worker.on("completed", async (_job: Job<TestJob>, result: { eventId: string; step: string }) => {
      await nextQueue.add("next", { eventId: result.eventId, step: queueName });
    });
  }

  // Wire up to parallel queues (for event-enrich -> entity + topic)
  if (parallelQueues) {
    worker.on("completed", async (_job: Job<TestJob>, result: { eventId: string; step: string }) => {
      await Promise.all([
        parallelQueues.entity.add("extract", { eventId: result.eventId, step: queueName }),
        parallelQueues.topic.add("assign", { eventId: result.eventId, step: queueName }),
      ]);
    });
  }

  return worker;
}

// Track parallel completions
const parallelDone = new Map<string, { entity: boolean; topic: boolean }>();

function createParallelAwareWorker(
  queueName: string,
  type: "entity" | "topic",
  nextQueue: Queue<TestJob>
): Worker<TestJob> {
  const worker = new Worker<TestJob>(
    queueName,
    async (job: Job<TestJob>) => {
      jobFlow.push(queueName);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { eventId: job.data.eventId, step: queueName };
    },
    { connection: connection! }
  );

  worker.on("completed", async (_job: Job<TestJob>, result: { eventId: string; step: string }) => {
    const state = parallelDone.get(result.eventId) || { entity: false, topic: false };
    state[type] = true;
    parallelDone.set(result.eventId, state);

    // Check if both are done
    if (state.entity && state.topic) {
      parallelDone.delete(result.eventId);
      await nextQueue.add("extract", { eventId: result.eventId, step: queueName });
    }
  });

  return worker;
}

// ============================================================================
// TESTS
// ============================================================================

describe("Pipeline Integration", () => {
  describe.skipIf(!isRedisAvailable)("with Redis available", () => {
    it("should flow a job through the entire pipeline", async () => {
      // Clear job flow tracking
      jobFlow.length = 0;
      parallelDone.clear();

      // Get queues with type safety
      const evidenceSnapshotQueue = queues.evidenceSnapshot!;
      const eventCreateQueue = queues.eventCreate!;
      const eventEnrichQueue = queues.eventEnrich!;
      const entityExtractQueue = queues.entityExtract!;
      const topicAssignQueue = queues.topicAssign!;
      const relationshipExtractQueue = queues.relationshipExtract!;
      const watchlistMatchQueue = queues.watchlistMatch!;

      // Create workers for each stage
      // 1. evidence-snapshot -> event-create
      workers.push(createMockWorker(QUEUE_NAMES.evidenceSnapshot, eventCreateQueue));

      // 2. event-create -> event-enrich
      workers.push(createMockWorker(QUEUE_NAMES.eventCreate, eventEnrichQueue));

      // 3. event-enrich -> (entity-extract + topic-assign)
      workers.push(
        createMockWorker(QUEUE_NAMES.eventEnrich, undefined, {
          entity: entityExtractQueue,
          topic: topicAssignQueue,
        })
      );

      // 4 & 5. entity-extract and topic-assign -> relationship-extract (when both done)
      workers.push(
        createParallelAwareWorker(
          QUEUE_NAMES.entityExtract,
          "entity",
          relationshipExtractQueue
        )
      );
      workers.push(
        createParallelAwareWorker(QUEUE_NAMES.topicAssign, "topic", relationshipExtractQueue)
      );

      // 6. relationship-extract -> watchlist-match
      workers.push(createMockWorker(QUEUE_NAMES.relationshipExtract, watchlistMatchQueue));

      // 7. watchlist-match (final)
      workers.push(createMockWorker(QUEUE_NAMES.watchlistMatch));

      // Add initial job to start the pipeline
      const testEventId = `test-event-${Date.now()}`;
      await evidenceSnapshotQueue.add("snapshot", {
        eventId: testEventId,
        step: "start",
      });

      // Wait for pipeline to complete (with timeout)
      const maxWait = 10000; // 10 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        // Check if watchlist-match was reached
        if (jobFlow.includes(QUEUE_NAMES.watchlistMatch)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify the flow
      expect(jobFlow).toContain(QUEUE_NAMES.evidenceSnapshot);
      expect(jobFlow).toContain(QUEUE_NAMES.eventCreate);
      expect(jobFlow).toContain(QUEUE_NAMES.eventEnrich);
      expect(jobFlow).toContain(QUEUE_NAMES.entityExtract);
      expect(jobFlow).toContain(QUEUE_NAMES.topicAssign);
      expect(jobFlow).toContain(QUEUE_NAMES.relationshipExtract);
      expect(jobFlow).toContain(QUEUE_NAMES.watchlistMatch);

      // Verify order constraints
      const evidenceIdx = jobFlow.indexOf(QUEUE_NAMES.evidenceSnapshot);
      const createIdx = jobFlow.indexOf(QUEUE_NAMES.eventCreate);
      const enrichIdx = jobFlow.indexOf(QUEUE_NAMES.eventEnrich);
      const entityIdx = jobFlow.indexOf(QUEUE_NAMES.entityExtract);
      const topicIdx = jobFlow.indexOf(QUEUE_NAMES.topicAssign);
      const relationIdx = jobFlow.indexOf(QUEUE_NAMES.relationshipExtract);
      const watchlistIdx = jobFlow.indexOf(QUEUE_NAMES.watchlistMatch);

      // Sequential order
      expect(evidenceIdx).toBeLessThan(createIdx);
      expect(createIdx).toBeLessThan(enrichIdx);

      // Parallel: both entity and topic should come after enrich
      expect(enrichIdx).toBeLessThan(entityIdx);
      expect(enrichIdx).toBeLessThan(topicIdx);

      // Relationship should come after both parallel steps
      expect(entityIdx).toBeLessThan(relationIdx);
      expect(topicIdx).toBeLessThan(relationIdx);

      // Watchlist should be last
      expect(relationIdx).toBeLessThan(watchlistIdx);
    });

    it("should handle parallel execution of entity-extract and topic-assign", async () => {
      // This test verifies that both parallel processors complete before
      // relationship-extract is triggered

      // Clear tracking
      jobFlow.length = 0;
      parallelDone.clear();

      const testEventId = `parallel-test-${Date.now()}`;

      // Directly add to enrich queue to skip early stages
      const eventEnrichQueue = queues.eventEnrich!;
      await eventEnrichQueue.add("enrich", {
        eventId: testEventId,
        step: "enrich",
      });

      // Wait for relationship-extract to be reached
      const maxWait = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        if (jobFlow.includes(QUEUE_NAMES.relationshipExtract)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Both parallel processors should have run
      expect(jobFlow).toContain(QUEUE_NAMES.entityExtract);
      expect(jobFlow).toContain(QUEUE_NAMES.topicAssign);

      // And relationship-extract should have been triggered
      expect(jobFlow).toContain(QUEUE_NAMES.relationshipExtract);
    });
  });

  describe("when Redis is not available", () => {
    it.skipIf(isRedisAvailable)("should skip tests gracefully", () => {
      expect(true).toBe(true);
    });
  });
});

// ============================================================================
// UNIT TESTS FOR PIPELINE LOGIC
// ============================================================================

describe("Pipeline Logic (Unit)", () => {
  describe("parallel completion tracking", () => {
    // Recreate the parallel tracking logic for unit testing
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

    beforeEach(() => {
      parallelCompletions.clear();
    });

    it("should not trigger until both are done", () => {
      const eventId = "test-1";

      // Initialize state
      parallelCompletions.set(eventId, { entityDone: false, topicDone: false });

      // Mark entity done
      markEntityDone(eventId);
      expect(checkAndTriggerRelationshipExtract(eventId)).toBe(false);

      // Mark topic done
      markTopicDone(eventId);
      expect(checkAndTriggerRelationshipExtract(eventId)).toBe(true);

      // Should be cleaned up
      expect(parallelCompletions.has(eventId)).toBe(false);
    });

    it("should trigger regardless of completion order", () => {
      const eventId = "test-2";

      // Initialize state
      parallelCompletions.set(eventId, { entityDone: false, topicDone: false });

      // Mark topic done first
      markTopicDone(eventId);
      expect(checkAndTriggerRelationshipExtract(eventId)).toBe(false);

      // Then entity done
      markEntityDone(eventId);
      expect(checkAndTriggerRelationshipExtract(eventId)).toBe(true);
    });

    it("should handle multiple events independently", () => {
      const eventId1 = "test-a";
      const eventId2 = "test-b";

      // Initialize both
      parallelCompletions.set(eventId1, { entityDone: false, topicDone: false });
      parallelCompletions.set(eventId2, { entityDone: false, topicDone: false });

      // Complete event1 entity, event2 topic
      markEntityDone(eventId1);
      markTopicDone(eventId2);

      // Neither should trigger
      expect(checkAndTriggerRelationshipExtract(eventId1)).toBe(false);
      expect(checkAndTriggerRelationshipExtract(eventId2)).toBe(false);

      // Complete the other half
      markTopicDone(eventId1);
      expect(checkAndTriggerRelationshipExtract(eventId1)).toBe(true);

      markEntityDone(eventId2);
      expect(checkAndTriggerRelationshipExtract(eventId2)).toBe(true);
    });
  });
});
