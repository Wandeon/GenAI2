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
  const dateStr = sevenDaysAgo.toISOString().slice(0, 10);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GenAI-Observatory/2.0",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    log("GITHUB_TOKEN not set, using unauthenticated API (10 req/min limit)");
  }

  // GitHub Search doesn't support multiple topic: with OR.
  // Fetch each topic separately and deduplicate by repo id.
  const seenIds = new Set<number>();
  const allRepos: GitHubRepo[] = [];

  for (const topic of AI_TOPICS) {
    const query = encodeURIComponent(`topic:${topic} pushed:>${dateStr} stars:>100`);
    const url = `${GITHUB_SEARCH_URL}?q=${query}&sort=stars&order=desc&per_page=10`;

    try {
      const res = await fetch(url, { headers });

      if (!res.ok) {
        const remaining = res.headers.get("x-ratelimit-remaining");
        log(`GitHub API error for topic ${topic}: ${res.status} (remaining: ${remaining})`);
        continue;
      }

      const data = await res.json();
      const repos: GitHubRepo[] = data.items || [];

      for (const repo of repos) {
        if (!seenIds.has(repo.id)) {
          seenIds.add(repo.id);
          allRepos.push(repo);
        }
      }
    } catch (error) {
      log(`Fetch error for topic ${topic}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Sort by stars descending, take top 30
  allRepos.sort((a, b) => b.stargazers_count - a.stargazers_count);
  const topRepos = allRepos.slice(0, 30);

  log(`Fetched ${topRepos.length} trending repos (${allRepos.length} total across ${AI_TOPICS.length} topics)`);

  return topRepos.map((repo) => {
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
}
