"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@genai/ui";
import { trpc } from "@/trpc";
import { DailyStreakBadge } from "@/components/daily/streak-badge";
import { CouncilHero } from "@/components/daily/council-hero";
import { CompactEventRow } from "@/components/events/compact-event-row";

import type { BriefingPayload } from "./types";

// ============================================================================
// Helpers
// ============================================================================

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(): string {
  return new Date().toLocaleDateString("hr-HR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ============================================================================
// DailyMobile
// ============================================================================

export function DailyMobile() {
  const router = useRouter();

  const { data: todayData, isLoading: briefingLoading } =
    trpc.dailyBriefings.todayOrLatest.useQuery();

  const briefing = todayData?.briefing ?? null;
  const isStale = todayData?.isLatest === true && briefing !== null;

  const { data: catchUp } = trpc.sessions.getCatchUp.useQuery();

  const { data: briefingWithEvents, isLoading: eventsLoading } =
    trpc.dailyBriefings.byIdWithEvents.useQuery(briefing?.id ?? "", {
      enabled: !!briefing?.id,
    });

  const { data: fallbackEvents, isLoading: fallbackLoading } =
    trpc.events.list.useQuery({ limit: 15 }, { enabled: !briefing });

  const payload = briefing?.payload as BriefingPayload | undefined;

  if (briefingLoading) {
    return <MobileSkeleton />;
  }

  const hasMissedEvents = catchUp && catchUp.count > 0;
  const rankedEvents = briefingWithEvents?.events ?? [];

  return (
    <div className="pb-20">
      {/* 1. Sticky mini header */}
      <header
        className={cn(
          "sticky top-0 z-20 bg-background/95 backdrop-blur-sm",
          "flex items-center justify-between px-3 py-2 border-b border-border",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">
            {formatDateHeader()}
          </span>
          {payload && (
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
              {payload.eventCount} dog. &middot; {payload.sourceCount} izv.
            </span>
          )}
        </div>
        <DailyStreakBadge />
      </header>

      {/* 2. Stale banner */}
      {isStale && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-800">
          Dananji briefing jos nije generiran — prikazujem zadnji dostupni
        </div>
      )}

      {/* 3. Compact catch-up bar */}
      {hasMissedEvents ? (
        <Link
          href="/live"
          className="flex items-center justify-between bg-amber-50 px-3 py-2 border-b border-amber-200 min-h-[44px]"
        >
          <span className="text-sm text-amber-800">
            Propustili ste{" "}
            <span className="font-mono font-semibold">{catchUp.count}</span>{" "}
            dogadaja
          </span>
          <span className="text-xs font-medium text-amber-700">&rarr;</span>
        </Link>
      ) : (
        <div className="flex items-center bg-emerald-50 px-3 py-2 border-b border-emerald-200 min-h-[44px]">
          <span className="text-sm text-emerald-800">U toku</span>
        </div>
      )}

      {briefing ? (
        <div className="space-y-0">
          {/* 4. Council preview — 1 turn on mobile */}
          {payload?.roundtable && payload.roundtable.length > 0 && (
            <section className="px-3 py-3 border-b border-border">
              <CouncilHero turns={payload.roundtable} previewCount={1} />
            </section>
          )}

          {/* 5. Dense ranked list */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">
              Kljucni dogadaji
            </h2>
            {eventsLoading ? (
              <MobileListSkeleton />
            ) : rankedEvents.length > 0 ? (
              <div>
                {rankedEvents.slice(0, 10).map(({ rank, event }) => {
                  if (!event) return null;
                  return (
                    <CompactEventRow
                      key={event.id}
                      title={event.titleHr || event.title}
                      occurredAtLabel={formatTime(event.occurredAt)}
                      impactLevel={
                        event.impactLevel as
                          | "BREAKING"
                          | "HIGH"
                          | "MEDIUM"
                          | "LOW"
                      }
                      sourceCount={event.sourceCount ?? 1}
                      onOpen={() =>
                        router.push(`/observatory?event=${event.id}`)
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm px-3 py-4">
                Nema kljucnih dogadaja za danas
              </p>
            )}
          </section>
        </div>
      ) : (
        /* 6. Live fallback feed */
        <div>
          <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-800">
            Briefing jos nije dostupan — prikazujem najnovije dogadaje
          </div>
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">
              Kljucni dogadaji
            </h2>
            {fallbackLoading ? (
              <MobileListSkeleton />
            ) : fallbackEvents?.items && fallbackEvents.items.length > 0 ? (
              <div>
                {fallbackEvents.items.slice(0, 10).map((event) => (
                  <CompactEventRow
                    key={event.id}
                    title={event.titleHr || event.title}
                    occurredAtLabel={formatTime(event.occurredAt)}
                    impactLevel={
                      event.impactLevel as
                        | "BREAKING"
                        | "HIGH"
                        | "MEDIUM"
                        | "LOW"
                    }
                    sourceCount={event.sourceCount ?? 1}
                    onOpen={() =>
                      router.push(`/observatory?event=${event.id}`)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm px-3 py-4">
                Nema dostupnih dogadaja
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skeletons
// ============================================================================

function MobileSkeleton() {
  return (
    <div className="pb-20 animate-pulse">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="h-4 bg-card rounded w-28" />
        <div className="h-4 bg-card rounded w-16" />
      </div>
      <div className="px-3 py-2 border-b border-border">
        <div className="h-3 bg-card rounded w-48" />
      </div>
      <div className="px-3 py-3 border-b border-border space-y-2">
        <div className="h-3 bg-card rounded w-16" />
        <div className="h-10 bg-card rounded" />
      </div>
      <MobileListSkeleton />
    </div>
  );
}

function MobileListSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2 border-b border-border"
        >
          <div className="w-2 h-2 rounded-full bg-card shrink-0" />
          <div className="flex-1 h-4 bg-card rounded" />
          <div className="w-16 h-3 bg-card rounded" />
        </div>
      ))}
    </div>
  );
}
