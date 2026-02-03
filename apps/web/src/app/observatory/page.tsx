"use client";

import { useState, useMemo, useEffect } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import { trpc } from "@/trpc";
import { useTime } from "@/context/time-context";

export default function ObservatoryPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { targetTimestamp, isInPast, setCatchUpCount } = useTime();

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
      isSelected={selectedEventId === event.id}
      onClick={() => {
        setSelectedEventId(event.id);
        console.log("Selected event:", event.id, event.url);
      }}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
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
  );
}
