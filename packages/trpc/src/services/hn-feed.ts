// packages/trpc/src/services/hn-feed.ts
import {
  RawFeedItem,
  NormalizedEvent,
  calculateImpactLevel,
  extractTopics,
} from "@genai/shared";

const HN_API = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
  type?: string;
}

async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchHNTopStories(
  limit = 30
): Promise<NormalizedEvent[]> {
  try {
    // Get top story IDs
    const res = await fetch(`${HN_API}/topstories.json`);
    if (!res.ok) return [];

    const ids: number[] = await res.json();
    const topIds = ids.slice(0, limit);

    // Fetch items in parallel
    const items = await Promise.all(topIds.map(fetchItem));

    // Filter AI-related stories and normalize
    const aiKeywords = [
      "ai",
      "gpt",
      "llm",
      "openai",
      "anthropic",
      "claude",
      "gemini",
      "machine learning",
      "deep learning",
      "neural",
      "transformer",
      "chatgpt",
      "copilot",
      "mistral",
      "llama",
      "deepmind",
    ];

    const events: NormalizedEvent[] = [];

    for (const item of items) {
      if (!item || !item.title || item.type !== "story") continue;

      const titleLower = item.title.toLowerCase();
      const isAIRelated = aiKeywords.some((kw) => titleLower.includes(kw));
      if (!isAIRelated) continue;

      const rawItem: RawFeedItem = {
        sourceType: "HN",
        externalId: String(item.id),
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        title: item.title,
        author: item.by,
        publishedAt: new Date((item.time || 0) * 1000),
        score: item.score,
        commentCount: item.descendants,
      };

      events.push({
        id: `hn-${item.id}`,
        sourceType: "HN",
        externalId: String(item.id),
        url: rawItem.url,
        title: item.title,
        occurredAt: rawItem.publishedAt,
        impactLevel: calculateImpactLevel(rawItem),
        sourceCount: 1,
        topics: extractTopics(rawItem),
      });
    }

    return events;
  } catch (error) {
    console.error("HN feed error:", error);
    return [];
  }
}
