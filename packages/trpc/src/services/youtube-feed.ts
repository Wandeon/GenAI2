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

  const allVideos: Array<{
    videoId: string;
    title: string;
    channelName: string;
    publishedAt: string;
  }> = [];

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
      impactLevel:
        views > 100000 ? "HIGH" : views > 10000 ? "MEDIUM" : "LOW",
      sourceCount: 1,
      topics: [v.channelName],
    };
  }) as NormalizedEvent[];
}
