"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/trpc";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function Header({
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const mobileOutside = mobileDropdownRef.current && !mobileDropdownRef.current.contains(target);
      const desktopOutside = desktopDropdownRef.current && !desktopDropdownRef.current.contains(target);
      if (mobileOutside && desktopOutside) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: searchData, isLoading: isSearching } =
    trpc.search.instant.useQuery(
      { query: debouncedQuery, limit: 10 },
      { enabled: debouncedQuery.length > 0 }
    );

  const results = searchData?.results ?? [];

  useEffect(() => {
    if (results.length > 0 && debouncedQuery.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [results.length, debouncedQuery.length]);

  const handleInputFocus = () => {
    if (results.length > 0) {
      setIsDropdownOpen(true);
    }
  };

  const handleResultClick = (_id: string) => {
    setIsDropdownOpen(false);
    onSearchChange("");
  };

  const getImpactBadgeClass = (
    impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW" | undefined
  ) => {
    switch (impactLevel) {
      case "BREAKING":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "HIGH":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "MEDIUM":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "LOW":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const SearchDropdown = () => (
    <>
      {isDropdownOpen && debouncedQuery.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Rezultati pretrage"
        >
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground">
              <span className="animate-pulse">Pretrazujem...</span>
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1" role="presentation">
              {results.map((result) => (
                <li key={result.id} role="option">
                  <button
                    onClick={() => handleResultClick(result.id)}
                    className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase text-muted-foreground">
                          {result.type}
                        </span>
                        {result.impactLevel && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded border ${getImpactBadgeClass(result.impactLevel)}`}
                          >
                            {result.impactLevel}
                          </span>
                        )}
                      </div>
                      <p className="font-medium truncate">{result.title}</p>
                      {result.titleHr && (
                        <p className="text-sm text-muted-foreground truncate">
                          {result.titleHr}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Nema rezultata za &quot;{debouncedQuery}&quot;
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <header className="glass-header">
      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="font-bold text-lg">GenAI.hr</span>
          </div>
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="p-2 min-w-[44px] min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            aria-label={mobileSearchOpen ? "Zatvori pretragu" : "Otvori pretragu"}
            aria-expanded={mobileSearchOpen}
          >
            <SearchIcon aria-hidden="true" />
          </button>
        </div>
        {mobileSearchOpen && (
          <div className="px-3 pb-3">
            <div className="relative" ref={mobileDropdownRef}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Pretrazi dogadaje, entitete, teme..."
                className="w-full rounded-md border px-3 py-2 bg-background"
                autoFocus
              />
              <SearchDropdown />
            </div>
          </div>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden md:block">
        <div className="flex items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <h1 className="text-xl font-bold whitespace-nowrap">GenAI Observatory</h1>
          </div>
          <div className="relative flex-1" ref={desktopDropdownRef}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="Pretrazi dogadaje, entitete, teme..."
              className="w-full rounded-md border px-3 py-2 bg-background"
            />
            <SearchDropdown />
          </div>
        </div>
      </div>
    </header>
  );
}
