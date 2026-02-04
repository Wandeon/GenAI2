"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/trpc";
import { EventsTimeline } from "@/components/entity/events-timeline";
import { RelatedEntities } from "@/components/entity/related-entities";
import { EntityGraph } from "@/components/entity/entity-graph";

const typeConfig: Record<string, { icon: string; color: string }> = {
  COMPANY: { icon: "🏢", color: "bg-blue-500" },
  LAB: { icon: "🔬", color: "bg-purple-500" },
  MODEL: { icon: "🤖", color: "bg-green-500" },
  PRODUCT: { icon: "📦", color: "bg-orange-500" },
  PERSON: { icon: "👤", color: "bg-pink-500" },
  REGULATION: { icon: "📜", color: "bg-red-500" },
  DATASET: { icon: "📊", color: "bg-cyan-500" },
  BENCHMARK: { icon: "📈", color: "bg-yellow-500" },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function EntityDossierPage({ params }: PageProps) {
  const { slug } = use(params);

  const { data: entity, isLoading } = trpc.entities.bySlug.useQuery(slug);

  if (isLoading) {
    return <DossierSkeleton />;
  }

  if (!entity) {
    notFound();
  }

  const config = typeConfig[entity.type] || { icon: "❓", color: "bg-gray-500" };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href="/observatory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Natrag na Observatory
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`${config.color} text-white px-2 py-1 rounded text-sm`}
          >
            {config.icon} {entity.type}
          </span>
          <span className="text-muted-foreground text-sm">
            {entity._count.mentions} spominjanja
          </span>
        </div>
        <h1 className="text-3xl font-bold">{entity.name}</h1>
        {entity.nameHr && entity.nameHr !== entity.name && (
          <p className="text-xl text-muted-foreground">{entity.nameHr}</p>
        )}
        {entity.aliases.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            Također poznato kao: {entity.aliases.map((a) => a.alias).join(", ")}
          </p>
        )}
      </header>

      {/* Description */}
      {entity.description && (
        <section className="mb-8">
          <p className="text-foreground">
            {entity.descriptionHr || entity.description}
          </p>
        </section>
      )}

      {/* Main content grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Events timeline (2 cols on desktop, full on mobile) */}
        <div className="md:col-span-2 order-2 md:order-1">
          <EventsTimeline entityId={entity.id} entityName={entity.name} />
        </div>

        {/* Sidebar (1 col on desktop, full on mobile) */}
        <div className="space-y-8 order-1 md:order-2">
          <RelatedEntities entityId={entity.id} />
        </div>
      </div>

      {/* Graph section */}
      <section className="mt-8">
        <EntityGraph entityId={entity.id} entityName={entity.name} />
      </section>
    </div>
  );
}

function DossierSkeleton() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-6" />
      <div className="h-6 w-24 bg-muted rounded mb-2" />
      <div className="h-10 w-64 bg-muted rounded mb-2" />
      <div className="h-6 w-48 bg-muted rounded mb-8" />
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 h-96 bg-muted rounded order-2 md:order-1" />
        <div className="h-64 bg-muted rounded order-1 md:order-2" />
      </div>
    </div>
  );
}
