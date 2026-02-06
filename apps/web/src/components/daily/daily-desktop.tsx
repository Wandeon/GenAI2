"use client";

import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/trpc";
import { DailyStreakBadge } from "@/components/daily/streak-badge";
import { CouncilHero } from "@/components/daily/council-hero";
import { RankedCards } from "@/components/daily/ranked-cards";

import type { BriefingPayload } from "./types";

export function DailyDesktop() {
  const { data: todayData, isLoading: briefingLoading } =
    trpc.dailyBriefings.todayOrLatest.useQuery();

  const briefing = todayData?.briefing ?? null;
  const isStale = todayData?.isLatest === true && briefing !== null;

  const { data: catchUp } = trpc.sessions.getCatchUp.useQuery();

  const { data: briefingWithEvents, isLoading: eventsLoading } =
    trpc.dailyBriefings.byIdWithEvents.useQuery(briefing?.id ?? "", {
      enabled: !!briefing?.id,
    });

  const payload = briefing?.payload as BriefingPayload | undefined;

  if (briefingLoading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-card rounded w-2/3" />
          <div className="h-4 bg-card rounded w-1/3" />
          <div className="h-px bg-border my-6" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 py-3">
              <div className="w-6 h-6 bg-card rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-card rounded w-3/4" />
                <div className="h-3 bg-card rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const todayFormatted = new Date().toLocaleDateString("hr-HR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasMissedEvents = catchUp && catchUp.count > 0;

  return (
    <div className="max-w-[720px] mx-auto px-4 py-8">
      {/* Date header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold capitalize">{todayFormatted}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-sm text-muted-foreground">
            {payload?.eventCount ?? 0} dogadaja &middot;{" "}
            {payload?.sourceCount ?? 0} izvora
          </span>
          <DailyStreakBadge />
        </div>
      </header>

      {/* Stale banner */}
      {isStale && briefing && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            Dananji briefing jos nije generiran — prikazujem zadnji dostupni
          </p>
        </div>
      )}

      {/* Catch-up status */}
      {hasMissedEvents ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-900">
              Propustili ste{" "}
              <span className="font-mono font-semibold">{catchUp.count}</span>{" "}
              dogadaja visokog utjecaja
            </p>
          </div>
          <Link
            href="/live"
            className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline shrink-0"
          >
            Prikazi
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            U toku ste sa svim dogadajima
          </p>
        </div>
      )}

      {!briefing ? (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg">Nema dostupnih briefinga</p>
          <p className="text-sm text-muted-foreground mt-1">
            Briefing se generira svaki dan u 06:00 CET
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Council hero section */}
          {payload?.roundtable && payload.roundtable.length > 0 && (
            <CouncilHero turns={payload.roundtable} />
          )}

          {/* Top ranked stack */}
          {eventsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-border">
                  <div className="w-8 h-8 bg-card rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-card rounded w-3/4" />
                    <div className="h-3 bg-card rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : briefingWithEvents?.events?.length ? (
            <RankedCards events={briefingWithEvents.events} />
          ) : (
            <p className="text-muted-foreground text-sm py-4">
              Nema kljucnih dogadaja za danas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
