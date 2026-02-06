"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/trpc";
import { getTypeConfig } from "./type-config";

interface RelationshipTimelineProps {
  entityId: string;
  entityName: string;
}

interface TimelineEntry {
  id: string;
  otherEntityName: string;
  otherEntitySlug: string;
  otherEntityType: string;
  relationshipType: string;
  isSubject: boolean;
}

const VERB_MAP: Record<string, { subject: string; object: string }> = {
  BEATS: { subject: "NADMASUJE", object: "NADMASEN OD" },
  PARTNERED: { subject: "PARTNERI S", object: "PARTNERI S" },
  USES: { subject: "KORISTI", object: "KORISTEN OD" },
  COMPETES: { subject: "KONKURIRA", object: "KONKURIRA" },
  ACQUIRED: { subject: "PREUZEO", object: "PREUZET OD" },
  RELEASED: { subject: "OBJAVIO", object: "OBJAVLJEN OD" },
  DEVELOPED: { subject: "RAZVIO", object: "RAZVIJEN OD" },
  FUNDED: { subject: "FINANCIRAO", object: "FINANCIRAN OD" },
  INVESTED: { subject: "INVESTIRAO U", object: "INVESTICIJA OD" },
  SUED: { subject: "TUZIO", object: "TUZEN OD" },
  HIRED: { subject: "ZAPOSLIO", object: "ZAPOSLEN OD" },
  TRAINED_ON: { subject: "TRENIRAN NA", object: "KORISTEN ZA TRENING" },
  BENCHMARKED_ON: { subject: "TESTIRAN NA", object: "KORISTEN ZA TEST" },
};

function getVerb(type: string, isSubject: boolean): string {
  const mapping = VERB_MAP[type];
  if (mapping) {
    return isSubject ? mapping.subject : mapping.object;
  }
  return type;
}

export function RelationshipTimeline({
  entityId,
  entityName,
}: RelationshipTimelineProps) {
  const { data, isLoading } = trpc.entities.graphData.useQuery({
    entityId,
    maxNodes: 30,
  });

  const entries = useMemo(() => {
    if (!data) return [] as TimelineEntry[];

    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const result: TimelineEntry[] = [];

    for (const link of data.links) {
      const isSubject = link.source === entityId;
      const otherId = isSubject ? link.target : link.source;
      const other = nodeMap.get(otherId);
      if (!other) continue;

      result.push({
        id: `${link.source}-${link.target}-${link.type}`,
        otherEntityName: other.name,
        otherEntitySlug: other.slug,
        otherEntityType: other.type as string,
        relationshipType: link.type,
        isSubject,
      });
    }

    return result;
  }, [data, entityId]);

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Kronologija odnosa</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-muted mt-2 shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-1" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Kronologija odnosa</h2>
        <p className="text-muted-foreground text-center py-6">
          Nema poznatih odnosa za {entityName}
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Kronologija odnosa</h2>
      <div className="relative">
        {/* Vertical timeline rail */}
        <div
          className="absolute left-[3px] top-1 bottom-1 w-0.5 bg-stone-200"
          aria-hidden="true"
        />

        <ul className="space-y-4" role="list">
          {entries.map((entry) => {
            const config = getTypeConfig(entry.otherEntityType);
            const verb = getVerb(entry.relationshipType, entry.isSubject);

            return (
              <li key={entry.id} className="relative flex items-start gap-3 pl-0">
                {/* Timeline dot */}
                <span
                  className="relative z-10 mt-1.5 block h-2 w-2 shrink-0 rounded-full border-2 border-stone-300 bg-white"
                  aria-hidden="true"
                />

                {/* Relationship description */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{entityName}</span>
                    {" "}
                    <span className="inline-block text-xs font-mono bg-stone-100 px-1.5 py-0.5 rounded">
                      {verb}
                    </span>
                    {" "}
                    <Link
                      href={`/explore/${entry.otherEntitySlug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {entry.otherEntityName}
                    </Link>
                  </p>
                  <span
                    className={`inline-block mt-1 text-xs ${config.badgeClass} px-1.5 py-0.5 rounded`}
                  >
                    {config.icon} {entry.otherEntityType}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
