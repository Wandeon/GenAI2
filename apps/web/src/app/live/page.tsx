"use client";

import Link from "next/link";
import { trpc } from "@/trpc";

const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

export default function LivePage() {
  const { data, isLoading } = trpc.events.list.useQuery({ limit: 100 });

  const events = data?.items ?? [];

  return (
    <div className="max-w-[720px] mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-1">Intel</h1>
      <p className="text-sm font-mono text-muted-foreground mb-6">
        Svi dogadaji, kronoloski
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse py-3 border-b border-border">
              <div className="h-4 bg-card rounded w-3/4 mb-2" />
              <div className="h-3 bg-card rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nema objavljenih dogadaja
        </p>
      ) : (
        <div className="divide-y divide-border">
          {events.map((event) => {
            const displayTitle = event.titleHr || event.title;
            const sourceLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
            const showDot = event.impactLevel === "BREAKING" || event.impactLevel === "HIGH";
            const dotColor = event.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500";
            const timeStr = new Date(event.occurredAt).toLocaleTimeString("hr-HR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Link
                key={event.id}
                href={`/observatory?event=${event.id}`}
                className="block py-3 hover:bg-card transition-colors -mx-2 px-2 rounded"
              >
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
