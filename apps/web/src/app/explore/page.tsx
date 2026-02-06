"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc";
import {
  ENTITY_TYPES,
  getTypeConfig,
  type EntityTypeKey,
} from "@/components/entity/type-config";

export default function ExplorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<EntityTypeKey[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setActiveIndex(-1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = trpc.entities.fuzzySearch.useQuery(
    {
      query: debouncedQuery,
      limit: 10,
      ...(selectedTypes.length > 0 && { types: selectedTypes }),
    },
    { enabled: debouncedQuery.length >= 2 }
  );

  const { data: popularEntities } = trpc.entities.topByMentions.useQuery(
    { limit: 8 },
    { enabled: debouncedQuery.length < 2 }
  );

  const { data: recentSearches } = trpc.sessions.getRecentSearches.useQuery(
    undefined,
    { enabled: debouncedQuery.length < 2 }
  );

  const addRecentSearch = trpc.sessions.addRecentSearch.useMutation();

  const handleSelect = useCallback(
    (slug: string, name?: string, type?: string) => {
      if (name && type) {
        addRecentSearch.mutate({
          query: debouncedQuery || slug,
          slug,
          name,
          type,
        });
      }
      router.push(`/explore/${slug}`);
    },
    [router, debouncedQuery, addRecentSearch]
  );

  const toggleType = (type: EntityTypeKey) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const r = results[activeIndex];
      handleSelect(r.slug, r.name, r.type);
    }
  };

  // Scroll active result into view
  useEffect(() => {
    if (activeIndex >= 0 && resultRefs.current[activeIndex]) {
      resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const showPopular = debouncedQuery.length < 2;

  return (
    <div className="p-4 md:p-6 max-w-[720px] mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dossier</h1>

      {/* Search input */}
      <input
        type="search"
        placeholder="Pretrazi tvrtke, osobe, projekte..."
        className="w-full rounded-md border border-border px-4 py-3 bg-background text-lg focus:ring-2 focus:ring-primary focus:outline-none"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        aria-label="Pretraga entiteta"
      />

      {/* Type filter pills */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtriraj po tipu">
        {ENTITY_TYPES.map((type) => {
          const config = getTypeConfig(type);
          const isActive = selectedTypes.includes(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                isActive
                  ? "bg-primary text-white border-transparent"
                  : "bg-card border-border hover:bg-card/80"
              }`}
              aria-pressed={isActive}
            >
              {config.icon} {type}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {isLoading && debouncedQuery.length >= 2 && (
        <p className="mt-4 text-muted-foreground animate-pulse">Trazim...</p>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <ul className="mt-4 space-y-1" role="listbox" aria-label="Rezultati pretrage">
          {results.map((entity, i) => {
            const config = getTypeConfig(entity.type);
            return (
              <li key={entity.id} role="option" aria-selected={i === activeIndex}>
                <button
                  ref={(el) => { resultRefs.current[i] = el; }}
                  onClick={() => handleSelect(entity.slug, entity.name, entity.type)}
                  className={`w-full text-left p-3 rounded-md transition-colors flex items-center gap-3 ${
                    i === activeIndex ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <span className={config.textColor}>{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{entity.name}</span>
                    {entity.nameHr && entity.nameHr !== entity.name && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {entity.nameHr}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                    {entity._count.mentions}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* No results */}
      {results && results.length === 0 && debouncedQuery.length >= 2 && (
        <p className="mt-4 text-muted-foreground">
          Nema rezultata za &quot;{debouncedQuery}&quot;
        </p>
      )}

      {/* Recent searches (when search is empty) */}
      {showPopular && recentSearches && recentSearches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Nedavno pretrazivano</h2>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search) => {
              const config = getTypeConfig(search.type);
              return (
                <button
                  key={search.slug}
                  onClick={() => handleSelect(search.slug, search.name, search.type)}
                  className="px-3 py-1.5 rounded-full bg-card border border-border hover:bg-card/80 text-sm flex items-center gap-1.5 transition-colors"
                >
                  <span className={config.textColor}>{config.icon}</span>
                  {search.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popular entities (when search is empty) */}
      {showPopular && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Popularni entiteti</h2>
          {popularEntities && popularEntities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {popularEntities.map((entity) => {
                const config = getTypeConfig(entity.type);
                return (
                  <button
                    key={entity.id}
                    onClick={() => handleSelect(entity.slug)}
                    className="px-3 py-1.5 rounded-full bg-card border border-border hover:bg-card/80 text-sm flex items-center gap-1.5 transition-colors"
                  >
                    <span className={config.textColor}>{config.icon}</span>
                    {entity.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="animate-pulse h-8 w-24 bg-muted rounded-full"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
