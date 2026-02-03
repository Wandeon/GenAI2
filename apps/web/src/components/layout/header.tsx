"use client";

import { useState, useEffect, useRef } from "react";
import { TimeMachine } from "@/components/time-machine";
import { useTime } from "@/context/time-context";
import { trpc } from "@/trpc";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// Search icon SVG component
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
  const { scrubberValue, setScrubberValue, catchUpCount, isInPast, targetTimestamp, jumpToNow } = useTime();

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const mobileOutside = mobileDropdownRef.current && !mobileDropdownRef.current.contains(target);
      const desktopOutside = desktopDropdownRef.current && !desktopDropdownRef.current.contains(target);

      // Close if clicked outside both dropdown containers
      if (mobileOutside && desktopOutside) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Query instant search
  const { data: searchData, isLoading: isSearching } =
    trpc.search.instant.useQuery(
      { query: debouncedQuery, limit: 10 },
      {
        enabled: debouncedQuery.length > 0,
      }
    );

  const results = searchData?.results ?? [];

  // Open dropdown when there are results
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

  // Shared search dropdown component for both mobile and desktop
  const SearchDropdown = () => (
    <>
      {isDropdownOpen && debouncedQuery.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground">
              <span className="animate-pulse">Pretrazujem...</span>
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    onClick={() => handleResultClick(result.id)}
                    className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors flex items-start gap-3"
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
    <header className="border-b bg-card">
      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-3">
          <span className="font-bold text-lg">GenAI.hr</span>
          <div className="flex items-center gap-2">
            {isInPast && (
              <button
                onClick={jumpToNow}
                className="text-xs text-amber-500 px-2 py-1 bg-amber-500/10 rounded"
              >
                {targetTimestamp.toLocaleDateString("hr-HR", {
                  day: "numeric",
                  month: "short",
                })}
              </button>
            )}
            <button
              onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
              className="p-2"
              aria-label="Pretrazi"
            >
              <SearchIcon />
            </button>
          </div>
        </div>
        {/* Expandable search on mobile */}
        {mobileSearchOpen && (
          <div className="px-3 pb-3">
            <div className="relative" ref={mobileDropdownRef}>
              <input
                ref={inputRef}
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
          <h1 className="text-xl font-bold whitespace-nowrap">Observatory</h1>
          <div className="relative flex-1" ref={desktopDropdownRef}>
            <input
              ref={inputRef}
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
        <div className="px-4 pb-4">
          <TimeMachine
            value={scrubberValue}
            onChange={setScrubberValue}
            catchUpCount={catchUpCount}
          />
        </div>
      </div>
    </header>
  );
}
