"use client";

import { useMemo, useEffect } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import { trpc } from "@/trpc";
import { useTime } from "@/context/time-context";
import { useSelection } from "@/context/selection-context";
import { useMobileLane, type LaneId } from "@/context/mobile-lane-context";
import { useSwipe } from "@/hooks";

const lanes: LaneId[] = ["hn", "github", "arxiv"];

export default function ObservatoryPage() {
  const { selectedEvent, selectEvent } = useSelection();
  const { targetTimestamp, isInPast, setCatchUpCount } = useTime();
  const { activeLane, setActiveLane } = useMobileLane();

  const currentIndex = lanes.indexOf(activeLane);

  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: () => {
      if (currentIndex < lanes.length - 1) {
        setActiveLane(lanes[currentIndex + 1]);
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        setActiveLane(lanes[currentIndex - 1]);
      }
    },
  });

  // Query all events (without time filter) for catch-up count calculation
  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const allEvents = eventsData?.items ?? [];

  // Filter events locally based on targetTimestamp when viewing the past
  const events = useMemo(() => {
    if (!isInPast) return allEvents;
    return allEvents.filter((e) => new Date(e.occurredAt) <= targetTimestamp);
  }, [allEvents, isInPast, targetTimestamp]);

  // Calculate and update catch-up count (events that occurred after targetTimestamp)
  const catchUpCount = useMemo(() => {
    if (!isInPast) return 0;
    return allEvents.filter((e) => new Date(e.occurredAt) > targetTimestamp).length;
  }, [allEvents, isInPast, targetTimestamp]);

  // Update context with catch-up count
  useEffect(() => {
    setCatchUpCount(catchUpCount);
  }, [catchUpCount, setCatchUpCount]);

  // Split by source type
  const hnEvents = useMemo(
    () => events.filter((e) => e.sourceType === "HN"),
    [events]
  );
  const ghEvents = useMemo(
    () => events.filter((e) => e.sourceType === "GITHUB"),
    [events]
  );
  const arxivEvents = useMemo(
    () => events.filter((e) => e.sourceType === "ARXIV"),
    [events]
  );

  const renderEventCard = (event: (typeof events)[0]) => (
    <EventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEvent?.id === event.id}
      onClick={() => {
        selectEvent(event);
      }}
    />
  );

  return (
    <div className="h-full">
      {/* Desktop: 3 columns */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 h-full">
        <Lane
          title="Hacker News"
          icon={<span className="text-orange-500">🔶</span>}
          count={hnEvents.length}
          isLoading={isLoading}
        >
          {hnEvents.length > 0 ? (
            hnEvents.map(renderEventCard)
          ) : (
            <p className="text-muted-foreground text-sm p-2">
              Nema HN vijesti
            </p>
          )}
        </Lane>

        <Lane
          title="GitHub"
          icon={<span>🐙</span>}
          count={ghEvents.length}
          isLoading={isLoading}
        >
          {ghEvents.length > 0 ? (
            ghEvents.map(renderEventCard)
          ) : (
            <p className="text-muted-foreground text-sm p-2">
              Nema GitHub projekata
            </p>
          )}
        </Lane>

        <Lane
          title="Radovi"
          icon={<span>📄</span>}
          count={arxivEvents.length}
          isLoading={isLoading}
        >
          {arxivEvents.length > 0 ? (
            arxivEvents.map(renderEventCard)
          ) : (
            <p className="text-muted-foreground text-sm p-2">
              Nema radova
            </p>
          )}
        </Lane>
      </div>

      {/* Mobile: Single lane based on active tab with swipe support */}
      <div
        className="md:hidden h-full pb-20"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeLane === "hn" && (
          <Lane
            title="Hacker News"
            icon={<span className="text-orange-500">🔶</span>}
            count={hnEvents.length}
            isLoading={isLoading}
          >
            {hnEvents.length > 0 ? (
              hnEvents.map(renderEventCard)
            ) : (
              <p className="text-muted-foreground text-sm p-2">
                Nema HN vijesti
              </p>
            )}
          </Lane>
        )}
        {activeLane === "github" && (
          <Lane
            title="GitHub"
            icon={<span>🐙</span>}
            count={ghEvents.length}
            isLoading={isLoading}
          >
            {ghEvents.length > 0 ? (
              ghEvents.map(renderEventCard)
            ) : (
              <p className="text-muted-foreground text-sm p-2">
                Nema GitHub projekata
              </p>
            )}
          </Lane>
        )}
        {activeLane === "arxiv" && (
          <Lane
            title="Radovi"
            icon={<span>📄</span>}
            count={arxivEvents.length}
            isLoading={isLoading}
          >
            {arxivEvents.length > 0 ? (
              arxivEvents.map(renderEventCard)
            ) : (
              <p className="text-muted-foreground text-sm p-2">
                Nema radova
              </p>
            )}
          </Lane>
        )}
      </div>
    </div>
  );
}
