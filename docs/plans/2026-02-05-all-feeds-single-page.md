# All Feeds + Single-Page Cockpit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port all 11 feed sources from old GenAI system into GenAI2's evidence pipeline, redesign the landing page as a single scrollable cockpit with source-grouped sections, and add a cron-based ingestion schedule.

**Architecture:** Feed services live in `packages/trpc/src/services/` as pure async functions that return `FeedItem[]`. The feed-ingest trigger calls them all and enqueues `evidence-snapshot` jobs. The landing page is one scrollable page with sections for each source group (News, Community, Research, Tools), plus briefing and stats. No tabs, no separate pages.

**Tech Stack:** TypeScript, BullMQ (cron repeatable jobs), tRPC services, Next.js (single page), Tailwind + framer-motion

---

## Pre-implementation Context

**Existing pipeline (GenAI2):**
- `apps/worker/src/triggers/feed-ingest.ts` - Fetches from 3 sources, enqueues evidence-snapshot jobs
- `packages/trpc/src/services/hn-feed.ts` - HN fetcher (working)
- `packages/trpc/src/services/github-feed.ts` - GitHub fetcher (broken, silently returns `[]`)
- `packages/trpc/src/services/arxiv-feed.ts` - arXiv fetcher (working)
- `apps/worker/src/index.ts` - Worker with 8 processors + pipeline wiring
- `apps/web/src/app/observatory/page.tsx` - Current cockpit with 3 hardcoded lanes

**Old system code to port (at `/home/wandeon/GenAI`):**
- `apps/worker/src/processors/reddit-ingest.ts` - Reddit public JSON API, 12 subreddits
- `apps/worker/src/processors/devto-ingest.ts` - Dev.to API, 7 AI tags
- `apps/worker/src/processors/lobsters-ingest.ts` - Lobste.rs hottest, AI tag filter
- `apps/worker/src/processors/huggingface-ingest.ts` - HF models API, pipeline tag filter
- `apps/worker/src/processors/youtube-ingest.ts` - YouTube Data API v3, 6 AI channels
- `apps/worker/src/processors/producthunt-ingest.ts` - PH GraphQL API, OAuth flow
- `apps/worker/src/processors/leaderboard-ingest.ts` - HF Open LLM Leaderboard
- `packages/newsapi/` - Full NewsAPI client package with rate limiter

**API keys available in Infisical:**
- `NEWSAPI_KEY` - NewsAPI.org (100 req/day free tier)
- `PRODUCTHUNT_API_KEY` + `PRODUCTHUNT_API_SECRET` - ProductHunt OAuth
- `YOUTUBE_API_KEY` - YouTube Data API v3
- `GOOGLE_AI_API_KEY` - Already in use

**Key difference from old system:** Old system saved to per-source tables (RedditPost, DevtoArticle, etc.) then ran LLM processing. New system feeds everything through the unified evidence pipeline: feed-ingest → evidence-snapshot → event-create → event-enrich → ...

---

## Tasks Overview

| Task | Focus | Files |
|------|-------|-------|
| 1 | Fix GitHub feed + add error handling | github-feed.ts |
| 2 | Port Reddit feed service | reddit-feed.ts |
| 3 | Port Dev.to feed service | devto-feed.ts |
| 4 | Port Lobsters feed service | lobsters-feed.ts |
| 5 | Port HuggingFace feed service | huggingface-feed.ts |
| 6 | Port YouTube feed service | youtube-feed.ts |
| 7 | Port ProductHunt feed service | producthunt-feed.ts |
| 8 | Port NewsAPI feed service | newsapi-feed.ts |
| 9 | Port Leaderboard feed service | leaderboard-feed.ts |
| 10 | Wire all feeds into feed-ingest trigger | feed-ingest.ts |
| 11 | Add cron-based repeatable ingestion | worker/index.ts |
| 12 | Redesign cockpit as single scrollable page | observatory/page.tsx + components |
| 13 | Pull API keys from Infisical, deploy, test | .env, deploy |

---

## Task 1: Fix GitHub Feed Service

The current GitHub feed silently returns `[]` on errors. Fix it and add proper auth.

**Files:**
- Modify: `packages/trpc/src/services/github-feed.ts`

**Step 1: Read current file**

Read `packages/trpc/src/services/github-feed.ts` to understand current implementation.

**Step 2: Fix the GitHub feed service**

Replace the content with a version that:
- Uses `GITHUB_TOKEN` env var for authenticated requests (higher rate limits)
- Logs errors instead of silently swallowing them
- Handles rate limiting gracefully
- Returns `FeedItem[]` format (not just NormalizedEvent)

```typescript
// packages/trpc/src/services/github-feed.ts
import type { NormalizedEvent } from "@genai/shared";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";
const AI_TOPICS = "machine-learning OR deep-learning OR llm OR gpt OR artificial-intelligence OR transformer OR neural-network";

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[github-feed] ${msg}`);
}

export async function fetchGitHubTrending(): Promise<NormalizedEvent[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().split("T")[0];

  const query = `topic:${AI_TOPICS.split(" OR ").join(" OR topic:")} pushed:>${dateStr} stars:>100`;
  const url = `${GITHUB_SEARCH_URL}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GenAI-Observatory/2.0",
  };

  // Use token if available for higher rate limits (5000/hr vs 10/min)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    log("Warning: GITHUB_TOKEN not set, using unauthenticated API (10 req/min limit)");
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    log(`GitHub API error: ${res.status} ${res.statusText} (rate-limit remaining: ${remaining})`);
    if (res.status === 403 && remaining === "0") {
      const resetAt = res.headers.get("x-ratelimit-reset");
      log(`Rate limited. Resets at ${resetAt ? new Date(Number(resetAt) * 1000).toISOString() : "unknown"}`);
    }
    return [];
  }

  const data = await res.json();
  const items = data.items ?? [];

  log(`Fetched ${items.length} trending repos`);

  return items.map((repo: any) => ({
    id: `gh-${repo.id}`,
    sourceType: "GITHUB" as const,
    externalId: String(repo.id),
    url: repo.html_url,
    title: `${repo.full_name}: ${repo.description || "No description"}`,
    occurredAt: new Date(repo.pushed_at),
    impactLevel: repo.stargazers_count > 1000 ? "HIGH" : repo.stargazers_count > 500 ? "MEDIUM" : "LOW",
    sourceCount: 1,
    topics: (repo.topics || []).slice(0, 5),
  })) as NormalizedEvent[];
}
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add packages/trpc/src/services/github-feed.ts
git commit -m "fix(feeds): fix GitHub feed silent failures, add auth token support"
```

---

## Task 2: Port Reddit Feed Service

**Files:**
- Create: `packages/trpc/src/services/reddit-feed.ts`

**Step 1: Create Reddit feed service**

Port from old system. Key details from old code:
- Uses Reddit public JSON API (no auth needed)
- Fetches from 12 AI subreddits
- Filters by MIN_SCORE = 25
- Rate limits 1.5s between subreddit fetches
- User-Agent: "GenAI-Bot/1.0 (+https://genai.hr)"

```typescript
// packages/trpc/src/services/reddit-feed.ts
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

      const data = await res.json();
      const posts: RedditPost[] = (data.data?.children ?? [])
        .filter((c: any) => c.kind === "t3")
        .map((c: any) => c.data);

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
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/reddit-feed.ts
git commit -m "feat(feeds): port Reddit feed service from old system"
```

---

## Task 3: Port Dev.to Feed Service

**Files:**
- Create: `packages/trpc/src/services/devto-feed.ts`

**Step 1: Create Dev.to feed service**

Port from old system. Key details:
- Public API, no auth needed
- Fetches across 7 AI tags
- Dedupes across tags by article ID

```typescript
// packages/trpc/src/services/devto-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Dev.to Feed - Fetches AI articles from Dev.to
// ============================================================================
// Uses public API (no auth required)

const DEVTO_API = "https://dev.to/api/articles";
const AI_TAGS = ["ai", "machinelearning", "llm", "openai", "gpt", "chatgpt", "artificialintelligence"];

interface DevtoArticle {
  id: number;
  title: string;
  url: string;
  user: { username: string; name: string };
  reading_time_minutes: number;
  positive_reactions_count: number;
  comments_count: number;
  tag_list: string[];
  published_at: string;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[devto-feed] ${msg}`);
}

export async function fetchDevtoArticles(): Promise<NormalizedEvent[]> {
  const allArticles: DevtoArticle[] = [];
  const seenIds = new Set<number>();

  for (const tag of AI_TAGS) {
    try {
      const res = await fetch(`${DEVTO_API}?tag=${tag}&per_page=20`);
      if (!res.ok) {
        log(`Tag ${tag} returned ${res.status}, skipping`);
        continue;
      }

      const articles: DevtoArticle[] = await res.json();
      for (const article of articles) {
        if (!seenIds.has(article.id)) {
          seenIds.add(article.id);
          allArticles.push(article);
        }
      }
    } catch (err) {
      log(`Tag ${tag} error: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  log(`Fetched ${allArticles.length} unique articles`);

  return allArticles.map((a) => ({
    id: `devto-${a.id}`,
    sourceType: "DEVTO" as const,
    externalId: String(a.id),
    url: a.url,
    title: a.title,
    occurredAt: new Date(a.published_at),
    impactLevel: a.positive_reactions_count > 100 ? "HIGH" : a.positive_reactions_count > 30 ? "MEDIUM" : "LOW",
    sourceCount: 1,
    topics: a.tag_list.slice(0, 5),
  })) as NormalizedEvent[];
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/devto-feed.ts
git commit -m "feat(feeds): port Dev.to feed service from old system"
```

---

## Task 4: Port Lobsters Feed Service

**Files:**
- Create: `packages/trpc/src/services/lobsters-feed.ts`

**Step 1: Create Lobsters feed service**

Port from old system. Key details:
- Public API, no auth
- Fetches hottest, filters for AI/ML/LLM tags

```typescript
// packages/trpc/src/services/lobsters-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Lobste.rs Feed - Fetches AI-tagged stories from Lobste.rs
// ============================================================================
// Uses public API (no auth required)

const LOBSTERS_URL = "https://lobste.rs/hottest.json";
const AI_TAGS = ["ai", "ml", "llm", "machine-learning"];

interface LobstersStory {
  short_id: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  submitter_user: { username: string };
  tags: string[];
  comments_url: string;
  created_at: string;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[lobsters-feed] ${msg}`);
}

export async function fetchLobstersStories(): Promise<NormalizedEvent[]> {
  const res = await fetch(LOBSTERS_URL);
  if (!res.ok) {
    log(`Lobsters API returned ${res.status}`);
    return [];
  }

  const stories: LobstersStory[] = await res.json();

  // Filter for AI-related tags
  const aiStories = stories.filter((s) =>
    s.tags.some((t) => AI_TAGS.includes(t.toLowerCase()))
  );

  log(`Fetched ${stories.length} stories, ${aiStories.length} AI-related`);

  return aiStories.map((s) => ({
    id: `lobsters-${s.short_id}`,
    sourceType: "LOBSTERS" as const,
    externalId: s.short_id,
    url: s.url || s.comments_url,
    title: s.title,
    occurredAt: new Date(s.created_at),
    impactLevel: s.score > 50 ? "HIGH" : s.score > 15 ? "MEDIUM" : "LOW",
    sourceCount: 1,
    topics: s.tags.slice(0, 5),
  })) as NormalizedEvent[];
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/lobsters-feed.ts
git commit -m "feat(feeds): port Lobsters feed service from old system"
```

---

## Task 5: Port HuggingFace Feed Service

**Files:**
- Create: `packages/trpc/src/services/huggingface-feed.ts`

**Step 1: Create HuggingFace feed service**

Port from old system. Key details:
- Public API, no auth
- Fetches recent models sorted by lastModified
- Filters for AI pipeline tags

```typescript
// packages/trpc/src/services/huggingface-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// HuggingFace Feed - Fetches trending AI models from HuggingFace Hub
// ============================================================================
// Uses public API (no auth required)

const HF_API = "https://huggingface.co/api/models";
const AI_PIPELINES = [
  "text-generation", "text2text-generation", "text-classification",
  "question-answering", "summarization", "conversational",
  "image-classification", "object-detection", "image-to-text",
  "text-to-image", "automatic-speech-recognition",
];

interface HFModel {
  id: string;
  author: string;
  lastModified: string;
  downloads: number;
  likes: number;
  pipeline_tag?: string;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[huggingface-feed] ${msg}`);
}

export async function fetchHuggingFaceModels(): Promise<NormalizedEvent[]> {
  const url = `${HF_API}?sort=lastModified&direction=-1&limit=50`;

  const res = await fetch(url);
  if (!res.ok) {
    log(`HuggingFace API returned ${res.status}`);
    return [];
  }

  const models: HFModel[] = await res.json();

  // Filter for AI pipeline tags
  const aiModels = models.filter(
    (m) => m.pipeline_tag && AI_PIPELINES.includes(m.pipeline_tag)
  );

  log(`Fetched ${models.length} models, ${aiModels.length} AI-related`);

  return aiModels.map((m) => {
    const name = m.id.includes("/") ? m.id.split("/")[1] : m.id;
    return {
      id: `hf-${m.id.replace(/\//g, "-")}`,
      sourceType: "HUGGINGFACE" as const,
      externalId: m.id,
      url: `https://huggingface.co/${m.id}`,
      title: `${name} by ${m.author} (${m.pipeline_tag})`,
      occurredAt: new Date(m.lastModified),
      impactLevel: m.likes > 100 ? "HIGH" : m.likes > 20 ? "MEDIUM" : "LOW",
      sourceCount: 1,
      topics: [m.pipeline_tag || "model"],
    };
  }) as NormalizedEvent[];
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/huggingface-feed.ts
git commit -m "feat(feeds): port HuggingFace feed service from old system"
```

---

## Task 6: Port YouTube Feed Service

**Files:**
- Create: `packages/trpc/src/services/youtube-feed.ts`

**Step 1: Create YouTube feed service**

Port from old system. Key details:
- Requires `YOUTUBE_API_KEY`
- Monitors 6 AI-focused channels
- Fetches video statistics (views, likes)

```typescript
// packages/trpc/src/services/youtube-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// YouTube Feed - Fetches videos from AI-focused YouTube channels
// ============================================================================
// Requires: YOUTUBE_API_KEY env var

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

const AI_CHANNELS = [
  { id: "UCbfYPyITQ-7l4upoX8nvctg", name: "Two Minute Papers" },
  { id: "UCZHmQk67mSJgfCCTn7xBfew", name: "Yannic Kilcher" },
  { id: "UCvjgXvBlLQH5sJYUNvI_zNw", name: "AI Explained" },
  { id: "UCUQo7nzH1sXVpzL92VesANw", name: "Fireship" },
  { id: "UCWN3xxRkmTPmbKwht9FuE5A", name: "Siraj Raval" },
  { id: "UC4JX40jDee_tINbkjycV4Sg", name: "ML Street Talk" },
];

interface YTSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YTStatsItem {
  id: string;
  statistics: { viewCount: string; likeCount: string; commentCount: string };
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[youtube-feed] ${msg}`);
}

export async function fetchYouTubeVideos(): Promise<NormalizedEvent[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    log("YOUTUBE_API_KEY not set, skipping");
    return [];
  }

  const allVideos: Array<{ videoId: string; title: string; channelName: string; publishedAt: string }> = [];

  for (const channel of AI_CHANNELS) {
    try {
      const url = `${YOUTUBE_API}/search?part=snippet&channelId=${channel.id}&type=video&maxResults=5&order=date&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        log(`Channel ${channel.name} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      for (const item of (data.items ?? []) as YTSearchItem[]) {
        allVideos.push({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelName: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
        });
      }
    } catch (err) {
      log(`Channel ${channel.name} error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  log(`Fetched ${allVideos.length} videos from ${AI_CHANNELS.length} channels`);

  // Fetch view counts in bulk
  const viewCounts = new Map<string, number>();
  if (allVideos.length > 0) {
    try {
      const ids = allVideos.map((v) => v.videoId).join(",");
      const statsUrl = `${YOUTUBE_API}/videos?part=statistics&id=${ids}&key=${apiKey}`;
      const res = await fetch(statsUrl);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items ?? []) as YTStatsItem[]) {
          viewCounts.set(item.id, parseInt(item.statistics.viewCount || "0", 10));
        }
      }
    } catch (err) {
      log(`Stats fetch error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return allVideos.map((v) => {
    const views = viewCounts.get(v.videoId) ?? 0;
    return {
      id: `yt-${v.videoId}`,
      sourceType: "YOUTUBE" as const,
      externalId: v.videoId,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      title: `[${v.channelName}] ${v.title}`,
      occurredAt: new Date(v.publishedAt),
      impactLevel: views > 100000 ? "HIGH" : views > 10000 ? "MEDIUM" : "LOW",
      sourceCount: 1,
      topics: [v.channelName],
    };
  }) as NormalizedEvent[];
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/youtube-feed.ts
git commit -m "feat(feeds): port YouTube feed service from old system"
```

---

## Task 7: Port ProductHunt Feed Service

**Files:**
- Create: `packages/trpc/src/services/producthunt-feed.ts`

**Step 1: Create ProductHunt feed service**

Port from old system. Key details:
- Requires `PRODUCTHUNT_API_KEY` + `PRODUCTHUNT_API_SECRET`
- OAuth client_credentials flow
- GraphQL API for AI-tagged posts

```typescript
// packages/trpc/src/services/producthunt-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// ProductHunt Feed - Fetches AI products from ProductHunt
// ============================================================================
// Requires: PRODUCTHUNT_API_KEY + PRODUCTHUNT_API_SECRET env vars

const PH_API = "https://api.producthunt.com/v2/api/graphql";
const PH_TOKEN_URL = "https://api.producthunt.com/v2/oauth/token";

const POSTS_QUERY = `
  query GetAIPosts {
    posts(first: 30, topic: "artificial-intelligence") {
      edges {
        node {
          id
          name
          tagline
          url
          votesCount
          commentsCount
          topics { edges { node { name } } }
          featuredAt
        }
      }
    }
  }
`;

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[producthunt-feed] ${msg}`);
}

export async function fetchProductHuntPosts(): Promise<NormalizedEvent[]> {
  const apiKey = process.env.PRODUCTHUNT_API_KEY;
  const apiSecret = process.env.PRODUCTHUNT_API_SECRET;

  if (!apiKey || !apiSecret) {
    log("PRODUCTHUNT_API_KEY/SECRET not set, skipping");
    return [];
  }

  // OAuth token exchange
  let accessToken: string;
  try {
    const tokenRes = await fetch(PH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      log(`OAuth token failed: ${tokenRes.status}`);
      return [];
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (err) {
    log(`OAuth error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  // Fetch posts
  try {
    const res = await fetch(PH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: POSTS_QUERY }),
    });

    if (!res.ok) {
      log(`GraphQL query failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const posts = data.data?.posts?.edges?.map((e: any) => e.node) ?? [];

    log(`Fetched ${posts.length} AI posts`);

    return posts.map((p: any) => {
      const topics = p.topics?.edges?.map((e: any) => e.node.name) ?? [];
      return {
        id: `ph-${p.id}`,
        sourceType: "PRODUCTHUNT" as const,
        externalId: p.id,
        url: p.url,
        title: `${p.name}: ${p.tagline}`,
        occurredAt: new Date(p.featuredAt),
        impactLevel: p.votesCount > 500 ? "HIGH" : p.votesCount > 100 ? "MEDIUM" : "LOW",
        sourceCount: 1,
        topics: topics.slice(0, 5),
      };
    }) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/producthunt-feed.ts
git commit -m "feat(feeds): port ProductHunt feed service from old system"
```

---

## Task 8: Port NewsAPI Feed Service

**Files:**
- Create: `packages/trpc/src/services/newsapi-feed.ts`

**Step 1: Create NewsAPI feed service**

Port from old system's `@genai/newsapi` package, simplified into a single service file. Key details:
- Requires `NEWSAPI_KEY` (100 req/day free tier)
- Query: AI-related keywords
- Blocks press release domains (globenewswire, prnewswire, etc.)

```typescript
// packages/trpc/src/services/newsapi-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// NewsAPI Feed - Fetches AI news articles from NewsAPI.org
// ============================================================================
// Requires: NEWSAPI_KEY env var (100 requests/day free tier)

const NEWSAPI_URL = "https://newsapi.org/v2/everything";

const QUERY = 'AI OR "artificial intelligence" OR ChatGPT OR Claude OR Gemini OR LLM OR "machine learning" OR OpenAI OR Anthropic';

const BLOCKED_DOMAINS = new Set([
  "globenewswire.com", "prnewswire.com", "businesswire.com",
  "accesswire.com", "newswire.com", "prweb.com",
  "yahoo.com", "msn.com", "news.google.com",
  "coindesk.com", "cointelegraph.com", "decrypt.co",
]);

interface NewsAPIArticle {
  source: { name: string };
  title: string;
  url: string;
  author: string | null;
  publishedAt: string;
  description: string | null;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[newsapi-feed] ${msg}`);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function fetchNewsAPIArticles(): Promise<NormalizedEvent[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    log("NEWSAPI_KEY not set, skipping");
    return [];
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const fromDate = yesterday.toISOString().split("T")[0];

  const params = new URLSearchParams({
    q: QUERY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "100",
    from: fromDate!,
  });

  try {
    const res = await fetch(`${NEWSAPI_URL}?${params}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      log(`NewsAPI returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (data.status !== "ok") {
      log(`NewsAPI error: ${data.message}`);
      return [];
    }

    const articles: NewsAPIArticle[] = data.articles ?? [];

    // Filter out blocked domains
    const filtered = articles.filter((a) => {
      const domain = extractDomain(a.url);
      return !BLOCKED_DOMAINS.has(domain);
    });

    log(`Fetched ${articles.length} articles, ${filtered.length} after filtering`);

    return filtered.map((a) => ({
      id: `newsapi-${Buffer.from(a.url).toString("base64url").slice(0, 20)}`,
      sourceType: "NEWSAPI" as const,
      externalId: a.url,
      url: a.url,
      title: a.title,
      occurredAt: new Date(a.publishedAt),
      impactLevel: "MEDIUM" as const,
      sourceCount: 1,
      topics: [a.source.name],
    })) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/newsapi-feed.ts
git commit -m "feat(feeds): port NewsAPI feed service from old system"
```

---

## Task 9: Port Leaderboard Feed Service

**Files:**
- Create: `packages/trpc/src/services/leaderboard-feed.ts`

**Step 1: Create Leaderboard feed service**

Port from old system. Key details:
- Uses HuggingFace Open LLM Leaderboard API
- No auth needed
- Tracks top 30 models by average score

```typescript
// packages/trpc/src/services/leaderboard-feed.ts
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Leaderboard Feed - Fetches AI model rankings from HF Open LLM Leaderboard
// ============================================================================
// Uses public API (no auth required)

const HF_LEADERBOARD_API = "https://open-llm-leaderboard-open-llm-leaderboard.hf.space/api/leaderboard";
const TOP_MODELS = 30;

interface HFLeaderboardEntry {
  fullname: string;
  "Average ⬆️": number;
  "#Params (B)": number;
  Type: string;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[leaderboard-feed] ${msg}`);
}

export async function fetchLeaderboardModels(): Promise<NormalizedEvent[]> {
  try {
    const res = await fetch(HF_LEADERBOARD_API, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      log(`HF Leaderboard API returned ${res.status}`);
      return [];
    }

    const data: HFLeaderboardEntry[] = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      log("Empty or invalid leaderboard data");
      return [];
    }

    const sorted = data
      .filter((m) => m["Average ⬆️"] > 0 && m.fullname)
      .sort((a, b) => b["Average ⬆️"] - a["Average ⬆️"])
      .slice(0, TOP_MODELS);

    log(`Fetched ${sorted.length} top models`);

    return sorted.map((entry, i) => {
      const name = entry.fullname.includes("/")
        ? entry.fullname.split("/")[1]
        : entry.fullname;
      const org = entry.fullname.includes("/")
        ? entry.fullname.split("/")[0]
        : "Unknown";

      return {
        id: `lb-${entry.fullname.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`,
        sourceType: "LEADERBOARD" as const,
        externalId: entry.fullname,
        url: `https://huggingface.co/${entry.fullname}`,
        title: `#${i + 1} ${name} by ${org} (score: ${entry["Average ⬆️"].toFixed(1)}, ${entry["#Params (B)"]}B params)`,
        occurredAt: new Date(),
        impactLevel: i < 5 ? "HIGH" : i < 15 ? "MEDIUM" : "LOW",
        sourceCount: 1,
        topics: ["leaderboard", entry.Type || "unknown"],
      };
    }) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/trpc/src/services/leaderboard-feed.ts
git commit -m "feat(feeds): port Leaderboard feed service from old system"
```

---

## Task 10: Wire All Feeds into Feed-Ingest Trigger

**Files:**
- Modify: `apps/worker/src/triggers/feed-ingest.ts`

**Step 1: Update FeedItem type to include all source types**

The `sourceType` union needs all 11 sources.

**Step 2: Rewrite feed-ingest.ts**

```typescript
// apps/worker/src/triggers/feed-ingest.ts
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
// Fetches items from ALL feed sources and enqueues evidence-snapshot jobs.
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

const isESMMain = process.argv[1]?.endsWith("feed-ingest.ts") || process.argv[1]?.endsWith("feed-ingest.js");

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
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/worker/src/triggers/feed-ingest.ts
git commit -m "feat(feeds): wire all 11 feed sources into ingestion trigger"
```

---

## Task 11: Add Cron-Based Repeatable Ingestion

**Files:**
- Modify: `apps/worker/src/index.ts`

**Step 1: Add a feed-ingest repeatable job**

Add a BullMQ repeatable job that runs `ingestFeeds()` every 2 hours. This uses BullMQ's built-in `repeat` option instead of external cron.

Add after the queue definitions block in `apps/worker/src/index.ts`:

```typescript
// Import feed ingestion
import { ingestFeeds } from "./triggers/feed-ingest";

// Add feed-ingest queue with repeatable job
const feedIngestQueue = new Queue("feed-ingest", { connection });

// Add feed-ingest worker
const feedIngestWorker = new Worker(
  "feed-ingest",
  async () => {
    log("Running scheduled feed ingestion...");
    const count = await ingestFeeds(redisUrl);
    log(`Scheduled ingestion complete: ${count} items enqueued`);
    return { count };
  },
  { connection }
);
feedIngestWorker.on("completed", (_job, result) => {
  log(`feed-ingest completed: ${result?.count ?? 0} items`);
});
feedIngestWorker.on("failed", (job, err) => {
  log(`feed-ingest failed: ${err.message}`);
});
workers.push(feedIngestWorker);

// Schedule repeatable job: every 2 hours
async function setupScheduledJobs() {
  // Feed ingestion every 2 hours
  await feedIngestQueue.add(
    "scheduled-ingest",
    {},
    {
      repeat: { every: 2 * 60 * 60 * 1000 }, // 2 hours in ms
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    }
  );
  log("Scheduled feed-ingest every 2 hours");

  // Daily briefing at 06:00 CET (05:00 UTC)
  await queues.dailyBriefing.add(
    "scheduled-briefing",
    { date: new Date().toISOString().split("T")[0]! },
    {
      repeat: { pattern: "0 5 * * *" }, // 05:00 UTC = 06:00 CET
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    }
  );
  log("Scheduled daily-briefing at 06:00 CET");
}

setupScheduledJobs().catch((err) => log(`Failed to setup scheduled jobs: ${err.message}`));
```

**Step 2: Also update the queues export to include feedIngest**

Add `feedIngest: feedIngestQueue` to the `queues` object.

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add apps/worker/src/index.ts
git commit -m "feat(worker): add cron-based feed ingestion every 2 hours"
```

---

## Task 12: Redesign Cockpit as Single Scrollable Page

The user wants NO tabs, NO pages - everything in sections on one scrollable page. Complete rethink.

**Files:**
- Modify: `apps/web/src/app/observatory/page.tsx` (complete rewrite)
- Modify: `apps/web/src/components/cockpit/stats-grid.tsx` (expand for all sources)
- Create: `apps/web/src/components/cockpit/source-section.tsx` (reusable section)
- Modify: `apps/web/src/context/mobile-lane-context.tsx` (expand LaneId for all sources)
- Delete or simplify: `apps/web/src/components/cockpit/news-lane.tsx` (replace with source-section)

### Step 1: Create the SourceSection component

A reusable section for each source group. Horizontal scroll on mobile, grid on desktop.

```typescript
// apps/web/src/components/cockpit/source-section.tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SourceSectionProps {
  title: string;
  icon: ReactNode;
  count: number;
  accentColor: string;
  glowClass: string;
  children: ReactNode;
  isLoading?: boolean;
  delay?: number;
}

export function SourceSection({
  title,
  icon,
  count,
  accentColor,
  glowClass,
  children,
  isLoading,
  delay = 0,
}: SourceSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`glass-card rounded-2xl overflow-hidden ${glowClass}`}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-sm tracking-wide">{title}</h2>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${accentColor}`}>
          {count}
        </span>
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-pulse text-muted-foreground text-sm">Ucitavanje...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {children}
          </div>
        )}
      </div>
    </motion.section>
  );
}
```

### Step 2: Update StatsGrid for all sources

```typescript
// apps/web/src/components/cockpit/stats-grid.tsx
"use client";

import { motion } from "framer-motion";

interface SourceStat {
  label: string;
  count: number;
  color: string;
  icon: string;
}

interface StatsGridProps {
  sources: SourceStat[];
  totalCount: number;
}

export function StatsGrid({ sources, totalCount }: StatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="glass-card rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
          Izvori
        </h2>
        <span className="text-xl font-bold font-mono text-blue-400">{totalCount}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {sources.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05, duration: 0.3 }}
            className="flex flex-col items-center p-2 rounded-lg bg-white/[0.02]"
          >
            <span className="text-sm">{s.icon}</span>
            <span className={`text-lg font-bold font-mono ${s.color}`}>{s.count}</span>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
```

### Step 3: Rewrite the observatory page

Complete rewrite as a single scrollable page with sections grouped by category:
- **Header**: StatusBar with live indicator
- **Overview**: BriefingCard + StatsGrid side by side
- **News** section: NewsAPI events
- **Community** section: HN + Reddit + Lobsters events
- **Research** section: arXiv + HuggingFace + Leaderboard events
- **Tools** section: GitHub + DevTo + ProductHunt events
- **Video** section: YouTube events

All rendered as SourceSection components with CockpitEventCard inside.

```typescript
// apps/web/src/app/observatory/page.tsx
"use client";

import { useMemo } from "react";
import { trpc } from "@/trpc";
import { useSelection } from "@/context/selection-context";
import { StatusBar } from "@/components/cockpit/status-bar";
import { BriefingCard } from "@/components/cockpit/briefing-card";
import { StatsGrid } from "@/components/cockpit/stats-grid";
import { SourceSection } from "@/components/cockpit/source-section";
import { CockpitEventCard } from "@/components/cockpit/cockpit-event-card";
import type { NormalizedEvent } from "@genai/shared";

// Source display config
const SOURCE_CONFIG: Record<string, { icon: string; color: string; glow: string; label: string }> = {
  NEWSAPI:      { icon: "📰", color: "text-blue-400",   glow: "glass-glow",        label: "NewsAPI" },
  HN:           { icon: "🔶", color: "text-orange-400", glow: "glass-glow-orange",  label: "HN" },
  REDDIT:       { icon: "🤖", color: "text-orange-300", glow: "glass-glow-orange",  label: "Reddit" },
  LOBSTERS:     { icon: "🦞", color: "text-red-400",    glow: "",                   label: "Lobsters" },
  ARXIV:        { icon: "📄", color: "text-green-400",  glow: "glass-glow-green",   label: "arXiv" },
  HUGGINGFACE:  { icon: "🤗", color: "text-yellow-400", glow: "",                   label: "HuggingFace" },
  LEADERBOARD:  { icon: "🏆", color: "text-amber-400",  glow: "",                   label: "Leaderboard" },
  GITHUB:       { icon: "🐙", color: "text-purple-400", glow: "glass-glow-purple",  label: "GitHub" },
  DEVTO:        { icon: "📝", color: "text-indigo-400", glow: "",                   label: "Dev.to" },
  PRODUCTHUNT:  { icon: "🚀", color: "text-orange-500", glow: "",                   label: "ProductHunt" },
  YOUTUBE:      { icon: "🎬", color: "text-red-500",    glow: "",                   label: "YouTube" },
};

// Group definitions: name → source types that belong to it
const GROUPS = [
  { name: "Vijesti",    sources: ["NEWSAPI"],                           icon: "📰", glow: "glass-glow" },
  { name: "Zajednica",  sources: ["HN", "REDDIT", "LOBSTERS"],         icon: "💬", glow: "glass-glow-orange" },
  { name: "Istrazivanje", sources: ["ARXIV", "HUGGINGFACE", "LEADERBOARD"], icon: "🔬", glow: "glass-glow-green" },
  { name: "Alati",      sources: ["GITHUB", "DEVTO", "PRODUCTHUNT"],   icon: "🛠️", glow: "glass-glow-purple" },
  { name: "Video",      sources: ["YOUTUBE"],                          icon: "🎬", glow: "" },
];

export default function ObservatoryPage() {
  const { selectedEvent, selectEvent } = useSelection();

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const events = eventsData?.items ?? [];
  const lastUpdate = events.length > 0 ? new Date(events[0].occurredAt) : null;

  // Group events by source type
  const bySource = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const list = map.get(event.sourceType) ?? [];
      list.push(event);
      map.set(event.sourceType, list);
    }
    return map;
  }, [events]);

  // Stats for the grid
  const sourcesStats = Object.entries(SOURCE_CONFIG).map(([type, cfg]) => ({
    label: cfg.label,
    count: bySource.get(type)?.length ?? 0,
    color: cfg.color,
    icon: cfg.icon,
  }));

  const renderCard = (event: NormalizedEvent) => (
    <CockpitEventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEvent?.id === event.id}
      onClick={() => selectEvent(event)}
    />
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Status Bar */}
        <StatusBar
          eventCount={events.length}
          lastUpdate={lastUpdate}
          isLoading={isLoading}
        />

        {/* Overview Row: Briefing + Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BriefingCard />
          <StatsGrid sources={sourcesStats} totalCount={events.length} />
        </div>

        {/* Source Group Sections */}
        {GROUPS.map((group, gi) => {
          const groupEvents = group.sources.flatMap((s) => bySource.get(s) ?? []);
          if (groupEvents.length === 0 && !isLoading) return null;

          // Sort by time descending
          const sorted = [...groupEvents].sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
          );

          return (
            <SourceSection
              key={group.name}
              title={group.name}
              icon={<span>{group.icon}</span>}
              count={sorted.length}
              accentColor="bg-white/10 text-foreground"
              glowClass={group.glow}
              isLoading={isLoading}
              delay={0.2 + gi * 0.1}
            >
              {sorted.length > 0 ? (
                sorted.map(renderCard)
              ) : (
                <p className="text-muted-foreground text-sm col-span-full text-center py-4">
                  Nema dogadaja
                </p>
              )}
            </SourceSection>
          );
        })}
      </div>
    </div>
  );
}
```

### Step 4: Clean up mobile-lane-context

Since we no longer have separate lanes, simplify or remove the mobile lane context. The page now scrolls vertically on all devices.

Update `apps/web/src/context/mobile-lane-context.tsx` - keep the provider but it's no longer used for navigation. The observatory layout still wraps children with it, so keep it to avoid breaking imports. It's a no-op now.

### Step 5: Delete news-lane.tsx (replaced by source-section.tsx)

Remove `apps/web/src/components/cockpit/news-lane.tsx` since SourceSection replaces it.

### Step 6: Run typecheck and build

```bash
rm -rf apps/web/.next && pnpm typecheck && pnpm build
```

### Step 7: Commit

```bash
git add apps/web/src/ packages/trpc/src/
git rm apps/web/src/components/cockpit/news-lane.tsx
git commit -m "feat(web): redesign cockpit as single scrollable page with all source sections"
```

---

## Task 13: Pull API Keys, Deploy, Test

**Files:**
- Modify: `.env` on VPS (via Infisical)
- Modify: `docker-compose.yml` if needed for new env vars

### Step 1: Pull secrets from Infisical on VPS

SSH to VPS and ensure all API keys are available:

```bash
ssh deploy@100.97.156.41
cd /opt/genai2
infisical export --env=prod > .env.check
grep -E "NEWSAPI_KEY|PRODUCTHUNT_API_KEY|PRODUCTHUNT_API_SECRET|YOUTUBE_API_KEY|GITHUB_TOKEN" .env.check
rm .env.check
```

If keys are missing from Infisical, add them via Infisical dashboard.

### Step 2: Update docker-compose.yml environment

Ensure the worker container has access to the new env vars. Check if docker-compose.yml uses `env_file: .env` or explicit `environment:` block. Add any missing vars.

### Step 3: Push to main, wait for CI

```bash
git push origin main
```

Wait for GH Actions to build Docker images.

### Step 4: Deploy manually

```bash
ssh deploy@100.97.156.41 "cd /opt/genai2 && docker compose pull && docker compose up -d --remove-orphans"
```

### Step 5: Verify containers

```bash
ssh deploy@100.97.156.41 "docker compose -f /opt/genai2/docker-compose.yml ps"
```

### Step 6: Run initial ingestion

SSH into the worker container and trigger a manual ingest to populate all sources:

```bash
ssh deploy@100.97.156.41 "docker compose -f /opt/genai2/docker-compose.yml exec worker node -e \"import('./dist/triggers/feed-ingest.js').then(m => m.ingestFeeds())\""
```

Or alternatively, the repeatable job will trigger within 2 hours.

### Step 7: Verify the landing page

```bash
curl -s https://v2.genai.hr/api/health
curl -s https://v2.genai.hr | head -20
```

Open https://v2.genai.hr and verify:
- All source sections visible
- Events from multiple sources appearing
- Stats grid shows counts per source
- Briefing card loads
- Mobile view scrolls smoothly

### Step 8: Commit any final fixes and deploy

```bash
git add . && git commit -m "chore: final deployment fixes" && git push
```

---

## LLM Cost Estimate

No additional LLM costs from this change. Feed ingestion is pure API fetching. LLM costs only occur downstream in the existing event-enrich processor (~$0.02/event). With ~200 events/day from all 11 sources, that's ~$4/day max.

**Mitigation:** Events go through fingerprint dedup before enrichment, so duplicates across sources are caught before LLM processing.

---

## Verification Checklist

After all tasks complete:

1. `pnpm typecheck` passes
2. `pnpm build` passes
3. All 11 feed services exist in `packages/trpc/src/services/`
4. `feed-ingest.ts` references all 11 sources
5. Worker has repeatable feed-ingest job (every 2 hours)
6. Observatory page renders all source groups as sections
7. No tabs, no separate pages - single scrollable cockpit
8. Events from new sources appear within 2 hours of deployment
9. API keys pulled from Infisical on VPS
