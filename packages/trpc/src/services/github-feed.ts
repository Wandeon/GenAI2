import {
  RawFeedItem,
  NormalizedEvent,
  calculateImpactLevel,
  extractTopics
} from "@genai/shared";

const GITHUB_API = "https://api.github.com";

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
  try {
    // Search for AI/ML repos updated in last 7 days with high stars
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateStr = date.toISOString().split("T")[0];

    const query = encodeURIComponent(
      `topic:machine-learning OR topic:deep-learning OR topic:llm OR topic:gpt pushed:>${dateStr} stars:>100`
    );

    const res = await fetch(
      `${GITHUB_API}/search/repositories?q=${query}&sort=stars&order=desc&per_page=20`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const repos: GitHubRepo[] = data.items || [];

    const events: NormalizedEvent[] = repos.map((repo) => {
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

    return events;
  } catch (error) {
    console.error("GitHub feed error:", error);
    return [];
  }
}
