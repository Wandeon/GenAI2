import { Queue } from "bullmq";
import IORedis from "ioredis";

// ============================================================================
// DAILY BRIEFING MANUAL TRIGGER
// ============================================================================
// Enqueues a daily-briefing job for a given date (defaults to today).
//
// Usage (inside Docker container):
//   npx tsx apps/worker/src/triggers/daily-briefing.ts
//   npx tsx apps/worker/src/triggers/daily-briefing.ts 2026-02-05
//
// Usage (from VPS host via Tailscale):
//   docker compose exec -T worker npx tsx apps/worker/src/triggers/daily-briefing.ts

function log(message: string): void {
  console.log(`[daily-briefing-trigger] ${message}`);
}

async function triggerDailyBriefing(
  date?: string,
  redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
): Promise<void> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  log(`Triggering daily briefing for ${targetDate}`);

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue("daily-briefing", { connection });

  try {
    await queue.add("manual-briefing", { date: targetDate });
    log(`Enqueued daily-briefing job for ${targetDate}`);
  } finally {
    await queue.close();
    await connection.quit();
  }
}

const isESMMain =
  process.argv[1]?.endsWith("daily-briefing.ts") ||
  process.argv[1]?.endsWith("daily-briefing.js");

if (isESMMain) {
  const date = process.argv[2]; // Optional: YYYY-MM-DD
  triggerDailyBriefing(date)
    .then(() => {
      log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
