"use client";

import { useRouter } from "next/navigation";
import { mapEventToCardProps } from "@/components/events/event-card-helpers";
import { UnifiedEventCard } from "@/components/events/unified-event-card";

// ============================================================================
// Types
// ============================================================================

interface BriefingEvent {
  rank: number;
  event: {
    id: string;
    title: string;
    titleHr?: string | null;
    occurredAt: Date;
    impactLevel: string;
    sourceType: string;
    sourceCount?: number;
    confidence?: string | null;
    artifacts: Array<{
      artifactType: string;
      payload: unknown;
      version?: number;
    }>;
    mentions?: Array<{
      entity: { id: string; name: string; slug: string; type: string };
    }>;
  } | null;
}

interface RankedCardsProps {
  events: BriefingEvent[];
  maxItems?: number;
}

// ============================================================================
// RankedCards
// ============================================================================

export function RankedCards({ events, maxItems = 5 }: RankedCardsProps) {
  const router = useRouter();
  const top = events.filter((e) => e.event !== null).slice(0, maxItems);

  if (top.length === 0) return null;

  return (
    <section className="space-y-3">
      {top.map(({ rank, event }) => {
        if (!event) return null;

        const artifacts = event.artifacts.map((a) => ({
          type: a.artifactType,
          payload: a.payload,
          version: a.version ?? 1,
        }));

        const entities = (event.mentions ?? []).map((m) => ({
          id: m.entity.id,
          name: m.entity.name,
          type: m.entity.type,
        }));

        const props = mapEventToCardProps(
          {
            title: event.title,
            titleHr: event.titleHr ?? undefined,
            occurredAt: event.occurredAt,
            impactLevel: event.impactLevel,
            sourceCount: event.sourceCount ?? 1,
            confidence: event.confidence,
            sourceType: event.sourceType,
          },
          artifacts,
          entities.map((e) => ({ ...e, role: "MENTION" })),
          [],
          () => router.push(`/observatory?event=${event.id}`),
        );

        return (
          <div key={event.id} className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-zinc-900 text-white font-mono text-sm font-bold flex items-center justify-center shrink-0 mt-1">
              {rank}
            </span>
            <div className="flex-1 min-w-0">
              <UnifiedEventCard {...props} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
