import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Reddit Feed - Fetches hot AI posts from configured subreddits
// ============================================================================
// Uses public JSON API (no auth required)
// Rate limited: 1.5s between subreddit fetches

const SUBREDDITS = [
  "ChatGPT", "OpenAI", "artificial", "ArtificialInteligence", "ChatGPTPro",
  "agi", "AIPromptProgramming", "ClaudeAI", "LocalLLaMA", "MachineLearning",
  "StableDiffusion", "singularity",
] as const;

const MIN_SCORE = 25;
const FETCH_LIMIT = 30;
const RATE_LIMIT_MS = 1500;
const USER_AGENT = "GenAI-Observatory/2.0 (+https://genai.hr)";

interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  subreddit: string;
}

interface RedditListingResponse {
  data: {
    children: Array<{ kind: string; data: RedditPost }>;
  };
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[reddit-feed] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRedditAIPosts(): Promise<NormalizedEvent[]> {
  const allPosts: RedditPost[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < SUBREDDITS.length; i++) {
    const subreddit = SUBREDDITS[i];
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${FETCH_LIMIT}`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!res.ok) {
        log(`r/${subreddit} returned ${res.status}, skipping`);
        continue;
      }

      const data: RedditListingResponse = await res.json();
      const posts: RedditPost[] = (data.data?.children ?? [])
        .filter((c) => c.kind === "t3")
        .map((c) => c.data);

      let added = 0;
      for (const post of posts) {
        if (post.score >= MIN_SCORE && !seenIds.has(post.id)) {
          seenIds.add(post.id);
          allPosts.push(post);
          added++;
        }
      }

      log(`r/${subreddit}: ${posts.length} fetched, ${added} qualifying`);
    } catch (err) {
      log(`r/${subreddit} error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Rate limit between subreddits
    if (i < SUBREDDITS.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  log(`Total: ${allPosts.length} qualifying posts from ${SUBREDDITS.length} subreddits`);

  return allPosts.map((post) => ({
    id: `reddit-${post.id}`,
    sourceType: "REDDIT" as const,
    externalId: post.id,
    url: post.url && !post.url.includes("reddit.com")
      ? post.url
      : `https://www.reddit.com${post.permalink}`,
    title: `[r/${post.subreddit}] ${post.title}`,
    occurredAt: new Date(post.created_utc * 1000),
    impactLevel: post.score > 500 ? "HIGH" : post.score > 100 ? "MEDIUM" : "LOW",
    sourceCount: 1,
    topics: [post.subreddit],
  })) as NormalizedEvent[];
}
