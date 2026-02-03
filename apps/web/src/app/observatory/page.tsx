"use client";

import { useState, useMemo } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import {
  mockEvents,
  filterEventsByTime,
  filterEventsByCategory,
  type MockEvent,
} from "@/lib/mock-events";

export default function ObservatoryPage() {
  const [scrubberValue] = useState(100);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const visibleEvents = useMemo(
    () => filterEventsByTime(mockEvents, scrubberValue),
    [scrubberValue]
  );

  const breakingEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "breaking"),
    [visibleEvents]
  );
  const researchEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "research"),
    [visibleEvents]
  );
  const industryEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "industry"),
    [visibleEvents]
  );

  const renderEventCard = (event: MockEvent) => (
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
      >
        {breakingEvents.length > 0 ? (
          breakingEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema breaking vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>

      <Lane
        title="Istraživanje"
        icon={<span>🔬</span>}
        count={researchEvents.length}
      >
        {researchEvents.length > 0 ? (
          researchEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema istraživačkih vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>

      <Lane
        title="Industrija"
        icon={<span>🏢</span>}
        count={industryEvents.length}
      >
        {industryEvents.length > 0 ? (
          industryEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema industrijskih vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>
    </div>
  );
}
