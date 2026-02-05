import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// Leaderboard Feed - Fetches AI model rankings from HF Open LLM Leaderboard
// ============================================================================
// Uses public API (no auth required)

const HF_LEADERBOARD_API =
  "https://open-llm-leaderboard-open-llm-leaderboard.hf.space/api/leaderboard";
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
