"use client";

import { trpc } from "@/trpc";
import { Lane } from "./lane";
import { EventCard } from "./event-card";
import { AlertTriangle } from "lucide-react";
import { useSelection } from "@/context/selection-context";

/**
 * Quarantine Lane
 *
 * Shows events with QUARANTINED status that need admin review.
 * These are events that failed safety gates or have conflicting sources.
 */
export function QuarantineLane() {
  const { selectedEvent, selectEvent } = useSelection();

  const { data, isLoading } = trpc.events.list.useQuery({
    limit: 50,
    status: "QUARANTINED",
  });

  const events = data?.items || [];

  return (
    <Lane
      title="Karantena"
      icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
      count={events.length}
      isLoading={isLoading}
    >
      {events.length > 0 ? (
        events.map((event) => (
          <div key={event.id} className="relative">
            {/* Yellow indicator bar */}
            <div className="absolute -left-1 top-2 w-1 h-8 bg-yellow-500 rounded-r" />
            <EventCard
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
          </div>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-8">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nema događaja u karanteni</p>
          <p className="text-xs mt-1 opacity-75">
            Svi događaji su prošli provjeru sigurnosti
          </p>
        </div>
      )}
    </Lane>
  );
}
