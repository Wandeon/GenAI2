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
  try {
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
      impactLevel:
        s.score > 50 ? "HIGH" : s.score > 15 ? "MEDIUM" : "LOW",
      sourceCount: 1,
      topics: s.tags.slice(0, 5),
    })) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
