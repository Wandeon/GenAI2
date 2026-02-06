"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { pickLatestArtifact } from "@genai/shared";
import { cn } from "@genai/ui";

const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

interface WhatHappenedPayload { en?: string; hr?: string; sourceLine?: string; }
interface WhyMattersPayload { text?: string; textHr?: string; }

interface RankedEvent {
  rank: number;
  event: {
    id: string;
    title: string;
    titleHr?: string | null;
    occurredAt: Date;
    impactLevel: string;
    sourceType: string;
    sourceCount?: number;
    confidence?: string | null;
    artifacts: Array<{ artifactType: string; payload: unknown; version?: number }>;
    mentions?: Array<{ entity: { id: string; name: string; slug: string; type: string } }>;
  } | null;
}

interface RankedEventListProps {
  events: RankedEvent[];
}

export function RankedEventList({ events }: RankedEventListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border">
      {events.map(({ rank, event }) => {
        if (!event) return null;
        const isOpen = openIndex === rank;
        return (
          <RankedEventRow
            key={event.id}
            rank={rank}
            event={event}
            isOpen={isOpen}
            onToggle={() => setOpenIndex(isOpen ? null : rank)}
          />
        );
      })}
    </div>
  );
}

function RankedEventRow({
  rank,
  event,
  isOpen,
  onToggle,
}: {
  rank: number;
  event: NonNullable<RankedEvent["event"]>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const displayTitle = event.titleHr || event.title;
  const sourceLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
  const timeStr = new Date(event.occurredAt).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const showDot = event.impactLevel === "BREAKING" || event.impactLevel === "HIGH";
  const dotColor = event.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500";

  const mapped = event.artifacts.map((a) => ({
    type: a.artifactType,
    payload: a.payload,
    version: a.version ?? 1,
  }));
  const whatHappened = pickLatestArtifact<WhatHappenedPayload>(mapped, "WHAT_HAPPENED");
  const whyMatters = pickLatestArtifact<WhyMattersPayload>(mapped, "WHY_MATTERS");

  return (
    <div className="py-3">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 group min-h-[44px]"
        aria-expanded={isOpen}
      >
        <span className="font-mono text-lg text-muted-foreground w-6 text-right shrink-0 pt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {showDot && <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />}
            <span className="font-semibold text-sm leading-snug line-clamp-1">
              {displayTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-muted-foreground">
            <span>[{sourceLabel}]</span>
            <span aria-hidden="true">&middot;</span>
            <span>{event.confidence || "MED"}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{event.sourceCount ?? 1} izvora</span>
            <span aria-hidden="true">&middot;</span>
            <span>{timeStr}</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="ml-9 mt-3 space-y-4 pb-2">
          {whatHappened && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Sto se dogodilo
              </h4>
              <p className="text-sm leading-relaxed">
                {whatHappened.payload.hr || whatHappened.payload.en || ""}
              </p>
            </div>
          )}

          {whyMatters && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Zasto je vazno
              </h4>
              <p className="text-sm leading-relaxed">
                {whyMatters.payload.textHr || whyMatters.payload.text || ""}
              </p>
            </div>
          )}

          {event.mentions && event.mentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {event.mentions.slice(0, 5).map((m) => (
                <Link
                  key={m.entity.id}
                  href={`/explore/${m.entity.slug}`}
                  className="text-xs font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  {m.entity.name}
                </Link>
              ))}
            </div>
          )}

          <Link
            href={`/observatory?event=${event.id}`}
            className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
          >
            Otvori dosje
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
