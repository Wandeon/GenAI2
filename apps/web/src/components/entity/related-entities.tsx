"use client";

import Link from "next/link";
import { trpc } from "@/trpc";
import { getTypeConfig } from "./type-config";

interface RelatedEntitiesProps {
  entityId: string;
}

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
          const config = getTypeConfig(entity.type);
          return (
            <Link
              key={entity.id}
              href={`/explore/${entity.slug}`}
              className="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={config.textColor}>{config.icon}</span>
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
