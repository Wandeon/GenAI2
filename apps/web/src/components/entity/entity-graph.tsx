"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/trpc";
import { ENTITY_TYPES, getTypeConfig, type EntityTypeKey } from "./type-config";

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
  const [typeFilters, setTypeFilters] = useState<EntityTypeKey[]>([]);
  const [relTypeFilter, setRelTypeFilter] = useState<string>("");

  // Infer the relationship type from the tRPC router input schema
  type GraphInput = Parameters<
    typeof trpc.entities.graphData.useQuery
  >[0];
  type RelType = NonNullable<
    Exclude<GraphInput, symbol>
  >["relationshipTypes"];

  const { data, isLoading } = trpc.entities.graphData.useQuery(
    {
      entityId,
      maxNodes: 30,
      ...(typeFilters.length > 0 && { entityTypes: typeFilters }),
      ...(relTypeFilter && {
        relationshipTypes: [relTypeFilter] as NonNullable<RelType>,
      }),
    },
    { enabled: isExpanded }
  );

  // Collect all unique relationship types from links for the dropdown
  const availableRelTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set(data.links.map((l) => l.type));
    return [...types].sort();
  }, [data]);

  // Build a map of node ID → relationship types for edge labels
  const nodeRelTypes = useMemo(() => {
    if (!data) return new Map<string, string[]>();
    const map = new Map<string, Set<string>>();
    for (const link of data.links) {
      const otherId = link.source === entityId ? link.target : link.source;
      if (!map.has(otherId)) map.set(otherId, new Set());
      map.get(otherId)!.add(link.type);
    }
    return new Map(
      [...map.entries()].map(([id, types]) => [id, [...types]])
    );
  }, [data, entityId]);

  const toggleTypeFilter = (type: EntityTypeKey) => {
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

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
          {/* Filter row */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtriraj po tipu entiteta">
              {ENTITY_TYPES.map((type) => {
                const config = getTypeConfig(type);
                const isActive = typeFilters.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                      isActive
                        ? `${config.bgColor} text-white border-transparent`
                        : "bg-secondary hover:bg-secondary/80 border-transparent"
                    }`}
                    aria-pressed={isActive}
                  >
                    {config.icon} {type}
                  </button>
                );
              })}
            </div>
            {availableRelTypes.length > 0 && (
              <select
                value={relTypeFilter}
                onChange={(e) => setRelTypeFilter(e.target.value)}
                className="text-xs rounded border bg-background px-2 py-1"
                aria-label="Filtriraj po tipu veze"
              >
                <option value="">Sve veze</option>
                {availableRelTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

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
                  .map((node) => {
                    const relTypes = nodeRelTypes.get(node.id);
                    return (
                      <Link
                        key={node.id}
                        href={`/explore/${node.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border hover:bg-accent transition-colors"
                        style={{ borderColor: typeColors[node.type] || "#666" }}
                      >
                        {node.name}
                        {relTypes && relTypes.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {relTypes.join(", ")}
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
