import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchHNTopStories } from "@genai/trpc/services/hn-feed";
import { fetchGitHubTrending } from "@genai/trpc/services/github-feed";
import { fetchArxivPapers } from "@genai/trpc/services/arxiv-feed";
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// FEED INGESTION TRIGGER
// ============================================================================
// Fetches items from various feeds (HN, GitHub, arXiv) and enqueues
// evidence-snapshot jobs for each item.
//
// Run via: pnpm ingest
//
// Uses existing feed services from @genai/trpc/services/

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
  process.env.NODE_ENV !== "test" &&
    console.log(`[feed-ingest] ${message}`);
}

// ============================================================================
// FEED SOURCE ADAPTERS
// ============================================================================
// These adapt the existing feed services (which return NormalizedEvent[])
// to the FeedItem[] format expected by the ingestion pipeline.

function normalizedEventToFeedItem(
  event: NormalizedEvent,
  sourceType: FeedItem["sourceType"]
): FeedItem {
  return {
    url: event.url,
    title: event.title,
    publishedAt: event.occurredAt,
    sourceType,
    sourceId: event.externalId,
  };
}

/**
 * Hacker News feed source - fetches AI-related stories from HN
 */
async function fetchHackerNewsItems(): Promise<FeedItem[]> {
  log("Fetching Hacker News items...");
  const events = await fetchHNTopStories(50); // Fetch top 50, filter for AI
  return events.map((e) => normalizedEventToFeedItem(e, "HN"));
}

/**
 * GitHub trending feed source - fetches trending AI/ML repos
 */
async function fetchGitHubItems(): Promise<FeedItem[]> {
  log("Fetching GitHub trending items...");
  const events = await fetchGitHubTrending();
  return events.map((e) => normalizedEventToFeedItem(e, "GITHUB"));
}

/**
 * arXiv feed source - fetches recent AI/ML papers
 */
async function fetchArxivItems(): Promise<FeedItem[]> {
  log("Fetching arXiv papers...");
  const events = await fetchArxivPapers();
  return events.map((e) => normalizedEventToFeedItem(e, "ARXIV"));
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
