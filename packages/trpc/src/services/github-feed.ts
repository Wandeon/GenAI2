import {
  type RawFeedItem,
  type NormalizedEvent,
  calculateImpactLevel,
  extractTopics,
} from "@genai/shared";

const GITHUB_SEARCH_URL = "https://api.github.com/search/repositories";
const AI_TOPICS = [
  "machine-learning", "deep-learning", "llm", "gpt",
  "artificial-intelligence", "transformer", "neural-network",
];

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[github-feed] ${msg}`);
}

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  pushed_at: string;
  owner: { login: string };
  topics: string[];
}

export async function fetchGitHubTrending(): Promise<NormalizedEvent[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().split("T")[0];

  const topicQuery = AI_TOPICS.map((t) => `topic:${t}`).join(" OR ");
  const query = encodeURIComponent(
    `${topicQuery} pushed:>${dateStr} stars:>100`
  );

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GenAI-Observatory/2.0",
  };

  // Use token if available for higher rate limits (5000/hr vs 10/min)
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    log("GITHUB_TOKEN not set, using unauthenticated API (10 req/min limit)");
  }

  const url = `${GITHUB_SEARCH_URL}?q=${query}&sort=stars&order=desc&per_page=30`;

  try {
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
    const repos: GitHubRepo[] = data.items || [];

    log(`Fetched ${repos.length} trending repos`);

    return repos.map((repo) => {
      const rawItem: RawFeedItem = {
        sourceType: "GITHUB",
        externalId: String(repo.id),
        url: repo.html_url,
        title: `${repo.full_name}: ${repo.description || repo.name}`,
        author: repo.owner.login,
        publishedAt: new Date(repo.pushed_at),
        score: repo.stargazers_count,
        tags: repo.topics,
      };

      return {
        id: `gh-${repo.id}`,
        sourceType: "GITHUB" as const,
        externalId: String(repo.id),
        url: repo.html_url,
        title: rawItem.title,
        occurredAt: rawItem.publishedAt,
        impactLevel: calculateImpactLevel(rawItem),
        sourceCount: 1,
        topics: repo.topics.slice(0, 5).length > 0
          ? repo.topics.slice(0, 5)
          : extractTopics(rawItem),
      };
    });
  } catch (error) {
    log(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
