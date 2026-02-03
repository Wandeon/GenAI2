import { Queue } from "bullmq";
import IORedis from "ioredis";

// ============================================================================
// FEED INGESTION TRIGGER
// ============================================================================
// Fetches items from various feeds (HN, GitHub, arXiv) and enqueues
// evidence-snapshot jobs for each item.
//
// Run via: pnpm ingest
//
// This is a SCAFFOLD - the actual feed fetching logic needs to be filled in
// once the feed service implementations are ready.

// ============================================================================
// TYPES
// ============================================================================

export interface FeedItem {
  url: string;
  title: string;
  content?: string;
  author?: string;
  publishedAt?: Date;
  sourceType: "HN" | "GITHUB" | "ARXIV" | "NEWSAPI";
  sourceId: string;
}

export interface FeedSource {
  name: string;
  type: FeedItem["sourceType"];
  fetch: () => Promise<FeedItem[]>;
}

// ============================================================================
// LOGGING
// ============================================================================

function log(message: string): void {
  console.log(`[feed-ingest] ${message}`);
}

// ============================================================================
// FEED SOURCE SCAFFOLDS
// ============================================================================
// These are placeholder implementations. Real implementations should:
// - Fetch from the actual APIs
// - Handle rate limiting
// - Handle pagination
// - Handle errors gracefully

/**
 * Hacker News feed source (scaffold)
 */
async function fetchHackerNewsItems(): Promise<FeedItem[]> {
  log("Fetching Hacker News items (scaffold - returns empty)");
  // TODO: Implement actual HN API fetching
  // GET https://hacker-news.firebaseio.com/v0/newstories.json
  // GET https://hacker-news.firebaseio.com/v0/item/{id}.json
  return [];
}

/**
 * GitHub trending/releases feed source (scaffold)
 */
async function fetchGitHubItems(): Promise<FeedItem[]> {
  log("Fetching GitHub items (scaffold - returns empty)");
  // TODO: Implement actual GitHub API fetching
  // Use GitHub REST API or GraphQL for:
  // - Trending repositories in AI/ML
  // - New releases from tracked repos
  // - Discussions/announcements
  return [];
}

/**
 * arXiv AI papers feed source (scaffold)
 */
async function fetchArxivItems(): Promise<FeedItem[]> {
  log("Fetching arXiv items (scaffold - returns empty)");
  // TODO: Implement actual arXiv API fetching
  // GET http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending
  return [];
}

// ============================================================================
// FEED SOURCES REGISTRY
// ============================================================================

const feedSources: FeedSource[] = [
  {
    name: "Hacker News",
    type: "HN",
    fetch: fetchHackerNewsItems,
  },
  {
    name: "GitHub",
    type: "GITHUB",
    fetch: fetchGitHubItems,
  },
  {
    name: "arXiv",
    type: "ARXIV",
    fetch: fetchArxivItems,
  },
];

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

/**
 * Ingest all feed sources and enqueue evidence-snapshot jobs.
 *
 * @param redisUrl - Redis connection URL
 * @returns Number of items enqueued
 */
export async function ingestFeeds(
  redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
): Promise<number> {
  log(`Starting feed ingestion with ${feedSources.length} sources`);

  // Create Redis connection
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Create queue for evidence-snapshot
  const evidenceSnapshotQueue = new Queue("evidence-snapshot", { connection });

  let totalEnqueued = 0;

  try {
    for (const source of feedSources) {
      log(`Fetching from ${source.name}...`);

      try {
        const items = await source.fetch();
        log(`Got ${items.length} items from ${source.name}`);

        // Enqueue each item
        for (const item of items) {
          await evidenceSnapshotQueue.add("snapshot", {
            url: item.url,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            // Additional data that could be passed to the processor
            // Note: This requires the processor to accept these fields
            // For now, the processor will fetch content itself
          });
          totalEnqueued++;
        }

        log(`Enqueued ${items.length} items from ${source.name}`);
      } catch (error) {
        log(`Error fetching from ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
        // Continue with other sources even if one fails
      }
    }

    log(`Feed ingestion complete: ${totalEnqueued} total items enqueued`);
    return totalEnqueued;
  } finally {
    // Clean up
    await evidenceSnapshotQueue.close();
    await connection.quit();
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

// Run when executed directly
const isMainModule =
  typeof process !== "undefined" &&
  typeof require !== "undefined" &&
  require.main === module;

// ESM detection
const isESMMain = process.argv[1]?.endsWith("feed-ingest.ts") || process.argv[1]?.endsWith("feed-ingest.js");

if (isMainModule || isESMMain) {
  ingestFeeds()
    .then((count) => {
      log(`Done! Enqueued ${count} items.`);
      process.exit(0);
    })
    .catch((error) => {
      log(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
