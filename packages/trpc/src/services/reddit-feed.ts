import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Reddit Feed - Fetches hot AI posts via OAuth API
// ============================================================================
// Uses Reddit OAuth (client_credentials) to avoid IP-based blocking
// Requires: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET

const SUBREDDITS = [
  "ChatGPT", "OpenAI", "artificial", "ArtificialInteligence", "ChatGPTPro",
  "agi", "AIPromptProgramming", "ClaudeAI", "LocalLLaMA", "MachineLearning",
  "StableDiffusion", "singularity",
] as const;

const MIN_SCORE = 25;
const FETCH_LIMIT = 30;
const RATE_LIMIT_MS = 1500;
const USER_AGENT = "GenAI-Observatory/2.0 (by /u/genai_hr)";

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

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Reddit OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  log("OAuth token acquired");
  return cachedToken.token;
}

export async function fetchRedditAIPosts(): Promise<NormalizedEvent[]> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log("REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not set, skipping");
    return [];
  }

  let token: string;
  try {
    token = await getOAuthToken(clientId, clientSecret);
  } catch (err) {
    log(`OAuth error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const allPosts: RedditPost[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < SUBREDDITS.length; i++) {
    const subreddit = SUBREDDITS[i];
    try {
      const url = `https://oauth.reddit.com/r/${subreddit}/hot?limit=${FETCH_LIMIT}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": USER_AGENT,
        },
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
