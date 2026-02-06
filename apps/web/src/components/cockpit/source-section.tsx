"use client";

import { motion } from "framer-motion";
import type { NormalizedEvent, SourceType } from "@genai/shared";
import { trpc } from "@/trpc";
import { UnifiedEventCard } from "@/components/events/unified-event-card";
import type { ImpactLevel, ConfidenceLabel, SourceKind, SourceChip } from "@/components/events/unified-event-card";

// ============================================================================
// SourceType → SourceKind mapping
// ============================================================================

const SOURCE_KIND_MAP: Record<SourceType, SourceKind> = {
  NEWSAPI: "NEWS",
  ARXIV: "PAPER",
  HUGGINGFACE: "PAPER",
  GITHUB: "CODE",
  DEVTO: "CODE",
  HN: "DISCUSSION",
  REDDIT: "DISCUSSION",
  LOBSTERS: "DISCUSSION",
  PRODUCTHUNT: "TOOL",
  LEADERBOARD: "TOOL",
  YOUTUBE: "VIDEO",
};

const SOURCE_LABEL_MAP: Record<SourceType, string> = {
  NEWSAPI: "NewsAPI",
  ARXIV: "arXiv",
  HUGGINGFACE: "HuggingFace",
  GITHUB: "GitHub",
  DEVTO: "Dev.to",
  HN: "HN",
  REDDIT: "Reddit",
  LOBSTERS: "Lobsters",
  PRODUCTHUNT: "ProductHunt",
  LEADERBOARD: "Ljestvica",
  YOUTUBE: "YouTube",
};

function buildSourceChip(sourceType: SourceType): SourceChip {
  return {
    label: SOURCE_LABEL_MAP[sourceType],
    kind: SOURCE_KIND_MAP[sourceType],
  };
}

function formatTimeHr(date: Date): string {
  return new Date(date).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// Types
// ============================================================================

interface SourceConfig {
  key: string;
  label: string;
  icon: string;
  accentColor: string;
}

interface SourceSectionProps {
  title: string;
  icon: string;
  sources: SourceConfig[];
  eventsBySource: Map<string, NormalizedEvent[]>;
  selectedEventId?: string;
  onSelectEvent: (event: NormalizedEvent) => void;
  isLoading?: boolean;
  delay?: number;
}

// ============================================================================
// Component
// ============================================================================

export function SourceSection({
  title,
  icon,
  sources,
  eventsBySource,
  selectedEventId,
  onSelectEvent,
  isLoading,
  delay = 0,
}: SourceSectionProps) {
  const utils = trpc.useUtils();

  const totalCount = sources.reduce(
    (sum, s) => sum + (eventsBySource.get(s.key)?.length ?? 0),
    0
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-base tracking-wide">{title}</h2>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-card text-muted-foreground">
          {totalCount}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse text-muted-foreground text-sm">
            Učitavanje...
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nema podataka iz ovih izvora
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {sources.map((source) => {
            const events = eventsBySource.get(source.key) ?? [];
            if (events.length === 0) return null;

            return (
              <div key={source.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-sm">{source.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {source.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${source.accentColor}`}
                  >
                    {events.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      onMouseEnter={() => utils.events.byId.prefetch(event.id)}
                    >
                      <UnifiedEventCard
                        title={event.titleHr ?? event.title}
                        occurredAtLabel={formatTimeHr(event.occurredAt)}
                        impactLevel={event.impactLevel as ImpactLevel}
                        confidenceLabel={(event.confidence as ConfidenceLabel) ?? null}
                        sourceCount={event.sourceCount}
                        whatHappened={event.summary}
                        sources={[buildSourceChip(event.sourceType)]}
                        onOpen={() => onSelectEvent(event)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
