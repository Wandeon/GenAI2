"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/trpc";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
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
    if (results.length > 0) setIsDropdownOpen(true);
  };

  const handleResultClick = (_id: string) => {
    setIsDropdownOpen(false);
    onSearchChange("");
  };

  const SearchDropdown = () => (
    <>
      {isDropdownOpen && debouncedQuery.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-sm z-50 max-h-80 overflow-y-auto"
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
                    className="w-full px-4 py-3 text-left hover:bg-card transition-colors flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          {result.type}
                        </span>
                        {result.impactLevel && (result.impactLevel === "BREAKING" || result.impactLevel === "HIGH") && (
                          <span className={`w-2 h-2 rounded-full ${result.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500"}`} />
                        )}
                      </div>
                      <p className="font-medium truncate">{result.title}</p>
                      {result.titleHr && (
                        <p className="text-sm text-muted-foreground truncate">{result.titleHr}</p>
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
    <header className="bg-background border-b border-border sticky top-0 z-40">
      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="font-semibold text-lg">GenAI</span>
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded text-muted-foreground"
            aria-label={mobileSearchOpen ? "Zatvori pretragu" : "Otvori pretragu"}
            aria-expanded={mobileSearchOpen}
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {mobileSearchOpen && (
          <div className="px-4 pb-3">
            <div className="relative" ref={mobileDropdownRef}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Pretrazi dogadaje, entitete..."
                className="w-full rounded-md border border-border px-3 py-2 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <SearchDropdown />
            </div>
          </div>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden md:block">
        <div className="flex items-center gap-4 px-6 h-14">
          <h1 className="text-lg font-semibold whitespace-nowrap">GenAI Observatory</h1>
          <div className="relative flex-1 max-w-md" ref={desktopDropdownRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="Pretrazi dogadaje, entitete..."
              className="w-full rounded-md border border-border pl-9 pr-3 py-1.5 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <SearchDropdown />
          </div>
          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap ml-auto">
            {new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </header>
  );
}
