import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Dev.to Feed - Fetches AI articles from Dev.to
// ============================================================================
// Uses public API (no auth required)

const DEVTO_API = "https://dev.to/api/articles";
const AI_TAGS = [
  "ai", "machinelearning", "llm", "openai",
  "gpt", "chatgpt", "artificialintelligence",
];

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
    impactLevel:
      a.positive_reactions_count > 100 ? "HIGH"
      : a.positive_reactions_count > 30 ? "MEDIUM"
      : "LOW",
    sourceCount: 1,
    topics: a.tag_list.slice(0, 5),
  })) as NormalizedEvent[];
}
