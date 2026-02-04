"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/trpc";

// ============================================================================
// EVENTS TIMELINE - Displays events related to an entity in the dossier page
// ============================================================================

interface EventsTimelineProps {
  entityId: string;
  entityName: string;
}

type MentionRole = "SUBJECT" | "OBJECT" | "MENTIONED";

const roleLabels: Record<MentionRole, string> = {
  SUBJECT: "Glavni akter",
  OBJECT: "Objekt",
  MENTIONED: "Spomenut",
};

export function EventsTimeline({ entityId, entityName }: EventsTimelineProps) {
  const [roleFilter, setRoleFilter] = useState<MentionRole | undefined>();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.events.byEntity.useInfiniteQuery(
    { entityId, role: roleFilter, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  const events = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Dogadaji</h2>
        <select
          value={roleFilter ?? ""}
          onChange={(e) =>
            setRoleFilter((e.target.value as MentionRole) || undefined)
          }
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          <option value="">Svi</option>
          <option value="SUBJECT">Glavni akter</option>
          <option value="OBJECT">Objekt</option>
          <option value="MENTIONED">Spomenut</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse p-4 border rounded-lg">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          Nema dogadaja za {entityName}
          {roleFilter && ` kao ${roleLabels[roleFilter].toLowerCase()}`}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/observatory?event=${event.id}`}
                className="block p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-2">
                      {event.titleHr || event.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(event.occurredAt).toLocaleDateString("hr-HR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full mt-4 py-2 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isFetchingNextPage ? "Ucitavam..." : "Prikazi vise"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
