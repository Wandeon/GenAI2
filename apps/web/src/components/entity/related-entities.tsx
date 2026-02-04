"use client";

import Link from "next/link";
import { trpc } from "@/trpc";

// ============================================================================
// RELATED ENTITIES - Displays entities connected through approved relationships
// Part of Phase 5 (Explore) - Entity Dossier
// ============================================================================

interface RelatedEntitiesProps {
  entityId: string;
}

const typeConfig: Record<string, { icon: string; color: string }> = {
  COMPANY: { icon: "🏢", color: "text-blue-500" },
  LAB: { icon: "🔬", color: "text-purple-500" },
  MODEL: { icon: "🤖", color: "text-green-500" },
  PRODUCT: { icon: "📦", color: "text-orange-500" },
  PERSON: { icon: "👤", color: "text-pink-500" },
  REGULATION: { icon: "📜", color: "text-red-500" },
  DATASET: { icon: "📊", color: "text-cyan-500" },
  BENCHMARK: { icon: "📈", color: "text-yellow-500" },
};

export function RelatedEntities({ entityId }: RelatedEntitiesProps) {
  const { data: related, isLoading } = trpc.entities.related.useQuery({
    entityId,
    limit: 10,
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-10 bg-muted rounded" />
          ))}
        </div>
      </section>
    );
  }

  if (!related || related.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
        <p className="text-sm text-muted-foreground">Nema povezanih entiteta</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Povezani entiteti</h2>
      <div className="space-y-2">
        {related.map(({ entity, connectionCount }) => {
          const config = typeConfig[entity.type] || {
            icon: "❓",
            color: "text-gray-500",
          };
          return (
            <Link
              key={entity.id}
              href={`/explore/${entity.slug}`}
              className="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={config.color}>{config.icon}</span>
                <span className="truncate">{entity.name}</span>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {connectionCount}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
