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

interface PHNode {
  id: string;
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  topics: { edges: Array<{ node: { name: string } }> };
  featuredAt: string;
}

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

    const tokenData: { access_token: string } = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (err) {
    log(`OAuth error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  // Fetch posts via GraphQL
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
    const posts: PHNode[] = data.data?.posts?.edges?.map((e: { node: PHNode }) => e.node) ?? [];

    log(`Fetched ${posts.length} AI posts`);

    return posts.map((p) => {
      const topics = p.topics?.edges?.map((e) => e.node.name) ?? [];
      return {
        id: `ph-${p.id}`,
        sourceType: "PRODUCTHUNT" as const,
        externalId: p.id,
        url: p.url,
        title: `${p.name}: ${p.tagline}`,
        occurredAt: new Date(p.featuredAt),
        impactLevel:
          p.votesCount > 500 ? "HIGH" : p.votesCount > 100 ? "MEDIUM" : "LOW",
        sourceCount: 1,
        topics: topics.slice(0, 5),
      };
    }) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
