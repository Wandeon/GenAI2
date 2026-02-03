"use client";

import { useState, useMemo } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import { trpc } from "@/trpc";

export default function ObservatoryPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 50,
    status: "PUBLISHED",
  });

  const events = eventsData?.items ?? [];

  const breakingEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "BREAKING"),
    [events]
  );
  const highEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "HIGH"),
    [events]
  );
  const otherEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "MEDIUM" || e.impactLevel === "LOW"),
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
      onClick={() => setSelectedEventId(event.id)}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      <Lane
        title="Breaking"
        icon={<span className="text-red-500">🔴</span>}
        count={breakingEvents.length}
        isLoading={isLoading}
      >
        {breakingEvents.length > 0 ? (
          breakingEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema breaking vijesti
          </p>
        )}
      </Lane>

      <Lane
        title="Važno"
        icon={<span className="text-orange-500">🟠</span>}
        count={highEvents.length}
        isLoading={isLoading}
      >
        {highEvents.length > 0 ? (
          highEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema važnih vijesti
          </p>
        )}
      </Lane>

      <Lane
        title="Ostalo"
        icon={<span>📰</span>}
        count={otherEvents.length}
        isLoading={isLoading}
      >
        {otherEvents.length > 0 ? (
          otherEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema ostalih vijesti
          </p>
        )}
      </Lane>
    </div>
  );
}
