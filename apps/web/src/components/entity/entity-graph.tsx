"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/trpc";

// ============================================================================
// ENTITY GRAPH - Collapsible view of connected entities (simple list view)
// Part of Phase 5 (Explore) - Entity Dossier
// Following Architecture Constitution #10: DOSSIER BEFORE GRAPH
// ============================================================================

interface EntityGraphProps {
  entityId: string;
  entityName: string;
}

const typeColors: Record<string, string> = {
  COMPANY: "#3b82f6",
  LAB: "#a855f7",
  MODEL: "#22c55e",
  PRODUCT: "#f97316",
  PERSON: "#ec4899",
  REGULATION: "#ef4444",
  DATASET: "#06b6d4",
  BENCHMARK: "#eab308",
};

export function EntityGraph({ entityId, entityName }: EntityGraphProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading } = trpc.entities.graphData.useQuery(
    { entityId, maxNodes: 30 },
    { enabled: isExpanded }
  );

  return (
    <section className="border rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-controls={`entity-graph-content-${entityId}`}
      >
        <h2 className="text-lg font-semibold">Graf povezanosti</h2>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-5 h-5" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div
          id={`entity-graph-content-${entityId}`}
          className="p-4 border-t"
          role="region"
          aria-label={`Graf povezanosti za ${entityName}`}
        >
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <span className="animate-pulse text-muted-foreground">
                Ucitavam graf...
              </span>
            </div>
          ) : !data || data.nodes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nema podataka za graf
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {data.nodes.length} entiteta, {data.links.length} poveznica
              </p>
              <div className="flex flex-wrap gap-2">
                {data.nodes
                  .filter((n) => n.id !== entityId)
                  .map((node) => (
                    <Link
                      key={node.id}
                      href={`/explore/${node.slug}`}
                      className="px-3 py-1 rounded-full text-sm border hover:bg-accent transition-colors"
                      style={{ borderColor: typeColors[node.type] || "#666" }}
                    >
                      {node.name}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
