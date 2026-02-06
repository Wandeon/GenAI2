"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@genai/ui";
import { trpc } from "@/trpc";
import {
  UnifiedEventCard,
} from "@/components/events/unified-event-card";
import type {
  ImpactLevel,
  ConfidenceLabel,
  SourceChip,
  SourceKind,
} from "@/components/events/unified-event-card";

// ============================================================================
// Types & Constants
// ============================================================================

type FilterKey = "Sve" | "Vijesti" | "Kod" | "Akademski" | "Zajednica" | "Alati";

const FILTERS: FilterKey[] = ["Sve", "Vijesti", "Kod", "Akademski", "Zajednica", "Alati"];

const FILTER_SOURCE_TYPES: Record<FilterKey, string[] | null> = {
  Sve: null,
  Vijesti: ["NEWSAPI"],
  Kod: ["GITHUB", "DEVTO"],
  Akademski: ["ARXIV", "HUGGINGFACE"],
  Zajednica: ["HN", "REDDIT", "LOBSTERS"],
  Alati: ["PRODUCTHUNT", "YOUTUBE", "LEADERBOARD"],
};

const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

const SOURCE_KIND_MAP: Record<string, SourceKind> = {
  NEWSAPI: "NEWS", ARXIV: "PAPER", HUGGINGFACE: "PAPER",
  GITHUB: "CODE", DEVTO: "CODE",
  HN: "DISCUSSION", REDDIT: "DISCUSSION", LOBSTERS: "DISCUSSION",
  PRODUCTHUNT: "TOOL", LEADERBOARD: "TOOL", YOUTUBE: "VIDEO",
};

// ============================================================================
// Component
// ============================================================================

export default function LivePage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("Sve");
  const { data, isLoading } = trpc.events.list.useQuery({ limit: 100 });

  const events = data?.items ?? [];

  const filteredEvents = useMemo(() => {
    const allowedTypes = FILTER_SOURCE_TYPES[activeFilter];
    if (!allowedTypes) return events;
    return events.filter((e) => allowedTypes.includes(e.sourceType));
  }, [events, activeFilter]);

  const handleFilterClick = (key: FilterKey) => {
    setActiveFilter((prev) => (prev === key ? "Sve" : key));
  };

  return (
    <div className="max-w-[720px] mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-1">Intel</h1>
      <p className="text-sm font-mono text-muted-foreground mb-4">
        Svi dogadaji, kronoloski
      </p>

      {/* Filter bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => handleFilterClick(key)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              "min-h-[36px]",
              activeFilter === key
                ? "bg-primary text-white"
                : "bg-card border border-border text-foreground hover:bg-accent",
            )}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse border-l-4 border-zinc-200 rounded-r-lg bg-white p-4">
              <div className="h-4 bg-card rounded w-3/4 mb-2" />
              <div className="h-3 bg-card rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nema dogadaja za odabrani filter
        </p>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const timeLabel = new Date(event.occurredAt).toLocaleTimeString("hr-HR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const sourceLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
            const sourceKind = SOURCE_KIND_MAP[event.sourceType] || "NEWS";
            const sources: SourceChip[] = [{ label: sourceLabel, kind: sourceKind }];

            return (
              <UnifiedEventCard
                key={event.id}
                title={event.titleHr || event.title}
                occurredAtLabel={timeLabel}
                impactLevel={event.impactLevel as ImpactLevel}
                confidenceLabel={(event.confidence as ConfidenceLabel) ?? null}
                sourceCount={event.sourceCount}
                whatHappened={event.summary}
                sources={sources}
                onOpen={() => router.push(`/observatory?event=${event.id}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
