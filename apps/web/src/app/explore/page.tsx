"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc";

export default function ExplorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: results, isLoading } = trpc.entities.fuzzySearch.useQuery(
    { query, limit: 10 },
    { enabled: query.length >= 2 }
  );

  const handleSelect = (slug: string) => {
    router.push(`/explore/${slug}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Istraži entitete</h1>

      <input
        type="search"
        placeholder="Pretraži tvrtke, osobe, projekte..."
        className="w-full rounded-md border px-4 py-3 bg-background text-lg"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {isLoading && query.length >= 2 && (
        <p className="mt-4 text-muted-foreground">Tražim...</p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((entity) => (
            <li key={entity.id}>
              <button
                onClick={() => handleSelect(entity.slug)}
                className="w-full text-left p-3 rounded-md hover:bg-accent transition-colors"
              >
                <span className="font-medium">{entity.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {entity.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {results && results.length === 0 && query.length >= 2 && (
        <p className="mt-4 text-muted-foreground">Nema rezultata za "{query}"</p>
      )}

      {query.length < 2 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Popularni entiteti</h2>
          <div className="flex flex-wrap gap-2">
            {["openai", "anthropic", "google", "meta", "microsoft"].map((slug) => (
              <button
                key={slug}
                onClick={() => handleSelect(slug)}
                className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-sm"
              >
                {slug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
