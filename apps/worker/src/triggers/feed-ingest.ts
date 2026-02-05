import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchHNTopStories } from "@genai/trpc/services/hn-feed";
import { fetchGitHubTrending } from "@genai/trpc/services/github-feed";
import { fetchArxivPapers } from "@genai/trpc/services/arxiv-feed";
import { fetchRedditAIPosts } from "@genai/trpc/services/reddit-feed";
import { fetchDevtoArticles } from "@genai/trpc/services/devto-feed";
import { fetchLobstersStories } from "@genai/trpc/services/lobsters-feed";
import { fetchHuggingFaceModels } from "@genai/trpc/services/huggingface-feed";
import { fetchYouTubeVideos } from "@genai/trpc/services/youtube-feed";
import { fetchProductHuntPosts } from "@genai/trpc/services/producthunt-feed";
import { fetchNewsAPIArticles } from "@genai/trpc/services/newsapi-feed";
import { fetchLeaderboardModels } from "@genai/trpc/services/leaderboard-feed";
import type { NormalizedEvent, SourceType } from "@genai/shared";

// ============================================================================
// FEED INGESTION TRIGGER
// ============================================================================
// Fetches items from ALL 11 feed sources and enqueues evidence-snapshot jobs.
//
// Run manually: pnpm ingest
// Or triggered by BullMQ repeatable job (every 2 hours)

export interface FeedItem {
  url: string;
  title: string;
  content?: string;
  author?: string;
  publishedAt?: Date;
  sourceType: SourceType;
  sourceId: string;
}

interface FeedSource {
  name: string;
  type: SourceType;
  fetch: () => Promise<FeedItem[]>;
}

function log(message: string): void {
  process.env.NODE_ENV !== "test" &&
    console.log(`[feed-ingest] ${message}`);
}

function normalizedEventToFeedItem(
  event: NormalizedEvent,
  sourceType: SourceType
): FeedItem {
  return {
    url: event.url,
    title: event.title,
    publishedAt: event.occurredAt,
    sourceType,
    sourceId: event.externalId,
  };
}

// ============================================================================
// FEED SOURCES REGISTRY - All 11 sources
// ============================================================================

const feedSources: FeedSource[] = [
  // --- Free, no API key ---
  {
    name: "Hacker News",
    type: "HN",
    fetch: async () => (await fetchHNTopStories(50)).map((e) => normalizedEventToFeedItem(e, "HN")),
  },
  {
    name: "GitHub Trending",
    type: "GITHUB",
    fetch: async () => (await fetchGitHubTrending()).map((e) => normalizedEventToFeedItem(e, "GITHUB")),
  },
  {
    name: "arXiv",
    type: "ARXIV",
    fetch: async () => (await fetchArxivPapers()).map((e) => normalizedEventToFeedItem(e, "ARXIV")),
  },
  {
    name: "Reddit",
    type: "REDDIT",
    fetch: async () => (await fetchRedditAIPosts()).map((e) => normalizedEventToFeedItem(e, "REDDIT")),
  },
  {
    name: "Dev.to",
    type: "DEVTO",
    fetch: async () => (await fetchDevtoArticles()).map((e) => normalizedEventToFeedItem(e, "DEVTO")),
  },
  {
    name: "Lobsters",
    type: "LOBSTERS",
    fetch: async () => (await fetchLobstersStories()).map((e) => normalizedEventToFeedItem(e, "LOBSTERS")),
  },
  {
    name: "HuggingFace Models",
    type: "HUGGINGFACE",
    fetch: async () => (await fetchHuggingFaceModels()).map((e) => normalizedEventToFeedItem(e, "HUGGINGFACE")),
  },
  {
    name: "LLM Leaderboard",
    type: "LEADERBOARD",
    fetch: async () => (await fetchLeaderboardModels()).map((e) => normalizedEventToFeedItem(e, "LEADERBOARD")),
  },
  // --- Require API keys ---
  {
    name: "YouTube",
    type: "YOUTUBE",
    fetch: async () => (await fetchYouTubeVideos()).map((e) => normalizedEventToFeedItem(e, "YOUTUBE")),
  },
  {
    name: "ProductHunt",
    type: "PRODUCTHUNT",
    fetch: async () => (await fetchProductHuntPosts()).map((e) => normalizedEventToFeedItem(e, "PRODUCTHUNT")),
  },
  {
    name: "NewsAPI",
    type: "NEWSAPI",
    fetch: async () => (await fetchNewsAPIArticles()).map((e) => normalizedEventToFeedItem(e, "NEWSAPI")),
  },
];

// ============================================================================
// MAIN INGESTION FUNCTION
// ============================================================================

export async function ingestFeeds(
  redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
): Promise<number> {
  log(`Starting feed ingestion with ${feedSources.length} sources`);

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const evidenceSnapshotQueue = new Queue("evidence-snapshot", { connection });

  let totalEnqueued = 0;

  try {
    for (const source of feedSources) {
      log(`Fetching from ${source.name}...`);

      try {
        const items = await source.fetch();
        log(`Got ${items.length} items from ${source.name}`);

        for (const item of items) {
          await evidenceSnapshotQueue.add("snapshot", {
            url: item.url,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            title: item.title,
            publishedAt: item.publishedAt?.toISOString(),
          });
          totalEnqueued++;
        }

        log(`Enqueued ${items.length} items from ${source.name}`);
      } catch (error) {
        log(`Error fetching from ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    log(`Feed ingestion complete: ${totalEnqueued} total items enqueued`);
    return totalEnqueued;
  } finally {
    await evidenceSnapshotQueue.close();
    await connection.quit();
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const isESMMain =
  process.argv[1]?.endsWith("feed-ingest.ts") ||
  process.argv[1]?.endsWith("feed-ingest.js");

if (isESMMain) {
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
