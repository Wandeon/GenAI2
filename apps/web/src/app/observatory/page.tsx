"use client";

import { useMemo } from "react";
import { trpc } from "@/trpc";
import { useSelection } from "@/context/selection-context";
import { useMobileLane, type LaneId } from "@/context/mobile-lane-context";
import { useSwipe } from "@/hooks";
import { StatusBar } from "@/components/cockpit/status-bar";
import { NewsLane } from "@/components/cockpit/news-lane";
import { BriefingCard } from "@/components/cockpit/briefing-card";
import { StatsGrid } from "@/components/cockpit/stats-grid";
import { CockpitEventCard } from "@/components/cockpit/cockpit-event-card";

const lanes: LaneId[] = ["hn", "github", "arxiv"];

export default function ObservatoryPage() {
  const { selectedEvent, selectEvent } = useSelection();
  const { activeLane, setActiveLane } = useMobileLane();

  const currentIndex = lanes.indexOf(activeLane);
  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: () => {
      if (currentIndex < lanes.length - 1) setActiveLane(lanes[currentIndex + 1]);
    },
    onSwipeRight: () => {
      if (currentIndex > 0) setActiveLane(lanes[currentIndex - 1]);
    },
  });

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const events = eventsData?.items ?? [];

  const hnEvents = useMemo(() => events.filter((e) => e.sourceType === "HN"), [events]);
  const ghEvents = useMemo(() => events.filter((e) => e.sourceType === "GITHUB"), [events]);
  const arxivEvents = useMemo(() => events.filter((e) => e.sourceType === "ARXIV"), [events]);

  const lastUpdate = events.length > 0 ? new Date(events[0].occurredAt) : null;

  const renderCard = (event: (typeof events)[0]) => (
    <CockpitEventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEvent?.id === event.id}
      onClick={() => selectEvent(event)}
    />
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Status Bar */}
      <StatusBar
        eventCount={events.length}
        lastUpdate={lastUpdate}
        isLoading={isLoading}
      />

      {/* Top Row: Briefing + Stats (desktop only) */}
      <div className="hidden md:grid md:grid-cols-2 gap-4" style={{ minHeight: "180px" }}>
        <BriefingCard />
        <StatsGrid
          totalCount={events.length}
          hnCount={hnEvents.length}
          ghCount={ghEvents.length}
          arxivCount={arxivEvents.length}
        />
      </div>

      {/* News Lanes */}
      <div className="flex-1 min-h-0">
        {/* Desktop: 3 columns */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 h-full">
          <NewsLane
            title="Hacker News"
            icon={<span className="text-orange-500">🔶</span>}
            count={hnEvents.length}
            accentColor="bg-orange-500/20 text-orange-400"
            glowClass="glass-glow-orange"
            isLoading={isLoading}
            delay={0.4}
          >
            {hnEvents.length > 0 ? hnEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema HN vijesti</p>
            )}
          </NewsLane>

          <NewsLane
            title="GitHub Trending"
            icon={<span>🐙</span>}
            count={ghEvents.length}
            accentColor="bg-purple-500/20 text-purple-400"
            glowClass="glass-glow-purple"
            isLoading={isLoading}
            delay={0.5}
          >
            {ghEvents.length > 0 ? ghEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema GitHub projekata</p>
            )}
          </NewsLane>

          <NewsLane
            title="arXiv Radovi"
            icon={<span>📄</span>}
            count={arxivEvents.length}
            accentColor="bg-green-500/20 text-green-400"
            glowClass="glass-glow-green"
            isLoading={isLoading}
            delay={0.6}
          >
            {arxivEvents.length > 0 ? arxivEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema radova</p>
            )}
          </NewsLane>
        </div>

        {/* Mobile: Single lane with swipe */}
        <div
          className="md:hidden h-full pb-20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeLane === "hn" && (
            <NewsLane title="Hacker News" icon="🔶" count={hnEvents.length} accentColor="bg-orange-500/20 text-orange-400" glowClass="" isLoading={isLoading}>
              {hnEvents.length > 0 ? hnEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema HN vijesti</p>}
            </NewsLane>
          )}
          {activeLane === "github" && (
            <NewsLane title="GitHub" icon="🐙" count={ghEvents.length} accentColor="bg-purple-500/20 text-purple-400" glowClass="" isLoading={isLoading}>
              {ghEvents.length > 0 ? ghEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema GitHub projekata</p>}
            </NewsLane>
          )}
          {activeLane === "arxiv" && (
            <NewsLane title="arXiv" icon="📄" count={arxivEvents.length} accentColor="bg-green-500/20 text-green-400" glowClass="" isLoading={isLoading}>
              {arxivEvents.length > 0 ? arxivEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema radova</p>}
            </NewsLane>
          )}
        </div>
      </div>
    </div>
  );
}
