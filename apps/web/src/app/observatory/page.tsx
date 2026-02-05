"use client";

import { useMemo } from "react";
import { trpc } from "@/trpc";
import { useSelection } from "@/context/selection-context";
import { StatusBar } from "@/components/cockpit/status-bar";
import { BriefingCard } from "@/components/cockpit/briefing-card";
import { StatsGrid } from "@/components/cockpit/stats-grid";
import { SourceSection } from "@/components/cockpit/source-section";
import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// SOURCE GROUP DEFINITIONS - 5 groups, 11 total sources
// ============================================================================

const SOURCE_GROUPS = [
  {
    title: "Vijesti",
    icon: "📰",
    glowClass: "glass-glow-red",
    sources: [
      { key: "NEWSAPI", label: "NewsAPI", icon: "📰", accentColor: "bg-red-500/20 text-red-400" },
    ],
  },
  {
    title: "Zajednica",
    icon: "💬",
    glowClass: "glass-glow-orange",
    sources: [
      { key: "HN", label: "Hacker News", icon: "🔶", accentColor: "bg-orange-500/20 text-orange-400" },
      { key: "REDDIT", label: "Reddit", icon: "🤖", accentColor: "bg-orange-500/20 text-orange-300" },
      { key: "LOBSTERS", label: "Lobsters", icon: "🦞", accentColor: "bg-red-500/20 text-red-300" },
    ],
  },
  {
    title: "Istraživanje",
    icon: "🔬",
    glowClass: "glass-glow-green",
    sources: [
      { key: "ARXIV", label: "arXiv", icon: "📄", accentColor: "bg-green-500/20 text-green-400" },
      { key: "HUGGINGFACE", label: "HuggingFace", icon: "🤗", accentColor: "bg-yellow-500/20 text-yellow-400" },
      { key: "LEADERBOARD", label: "Ljestvica", icon: "🏆", accentColor: "bg-yellow-500/20 text-yellow-300" },
    ],
  },
  {
    title: "Alati",
    icon: "🛠",
    glowClass: "glass-glow-purple",
    sources: [
      { key: "GITHUB", label: "GitHub", icon: "🐙", accentColor: "bg-purple-500/20 text-purple-400" },
      { key: "DEVTO", label: "Dev.to", icon: "📝", accentColor: "bg-purple-500/20 text-purple-300" },
      { key: "PRODUCTHUNT", label: "ProductHunt", icon: "🚀", accentColor: "bg-pink-500/20 text-pink-400" },
    ],
  },
  {
    title: "Video",
    icon: "🎬",
    glowClass: "glass-glow-cyan",
    sources: [
      { key: "YOUTUBE", label: "YouTube", icon: "▶", accentColor: "bg-cyan-500/20 text-cyan-400" },
    ],
  },
] as const;

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function ObservatoryPage() {
  const { selectedEventId, selectEvent } = useSelection();

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const events = eventsData?.items ?? [];

  // Build source → events map
  const eventsBySource = useMemo(() => {
    const map = new Map<string, NormalizedEvent[]>();
    for (const event of events) {
      const existing = map.get(event.sourceType) ?? [];
      existing.push(event);
      map.set(event.sourceType, existing);
    }
    return map;
  }, [events]);

  // Calculate group counts for stats
  const groupCounts = useMemo(() => {
    const countFor = (keys: readonly string[]) =>
      keys.reduce((sum, k) => sum + (eventsBySource.get(k)?.length ?? 0), 0);

    return {
      newsCount: countFor(["NEWSAPI"]),
      communityCount: countFor(["HN", "REDDIT", "LOBSTERS"]),
      researchCount: countFor(["ARXIV", "HUGGINGFACE", "LEADERBOARD"]),
      toolsCount: countFor(["GITHUB", "DEVTO", "PRODUCTHUNT"]),
      videoCount: countFor(["YOUTUBE"]),
    };
  }, [eventsBySource]);

  const lastUpdate = events.length > 0 ? new Date(events[0].occurredAt) : null;

  return (
    <div className="space-y-6 pb-8">
      {/* Status Bar */}
      <StatusBar
        eventCount={events.length}
        lastUpdate={lastUpdate}
        isLoading={isLoading}
      />

      {/* Top Row: Briefing + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: "160px" }}>
        <BriefingCard />
        <StatsGrid
          totalCount={events.length}
          {...groupCounts}
        />
      </div>

      {/* Source Sections - all in one scrollable column */}
      {SOURCE_GROUPS.map((group, i) => (
        <SourceSection
          key={group.title}
          title={group.title}
          icon={group.icon}
          glowClass={group.glowClass}
          sources={[...group.sources]}
          eventsBySource={eventsBySource}
          selectedEventId={selectedEventId ?? undefined}
          onSelectEvent={(event) => selectEvent(event.id)}
          isLoading={isLoading}
          delay={0.2 + i * 0.1}
        />
      ))}
    </div>
  );
}
