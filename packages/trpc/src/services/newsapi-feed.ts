import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// NewsAPI Feed - Fetches AI news articles from NewsAPI.org
// ============================================================================
// Requires: NEWSAPI_KEY env var (100 requests/day free tier)

const NEWSAPI_URL = "https://newsapi.org/v2/everything";

const QUERY =
  'AI OR "artificial intelligence" OR ChatGPT OR Claude OR Gemini OR LLM OR "machine learning" OR OpenAI OR Anthropic';

const BLOCKED_DOMAINS = new Set([
  // Press release aggregators
  "globenewswire.com", "prnewswire.com", "businesswire.com",
  "accesswire.com", "newswire.com", "prweb.com",
  // Aggregators
  "yahoo.com", "msn.com", "news.google.com",
  // Crypto spam
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
