"use client";

import { TimeMachine } from "@/components/time-machine";

interface HeaderProps {
  scrubberValue: number;
  onScrubberChange: (value: number) => void;
  catchUpCount?: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({
  scrubberValue,
  onScrubberChange,
  catchUpCount = 0,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="flex items-center gap-4 p-4">
        <h1 className="text-xl font-bold whitespace-nowrap">Observatory</h1>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Pretrazi dogadaje, entitete, teme..."
          className="flex-1 rounded-md border px-3 py-2 bg-background"
        />
      </div>
      <div className="px-4 pb-4">
        <TimeMachine
          value={scrubberValue}
          onChange={onScrubberChange}
          catchUpCount={catchUpCount}
        />
      </div>
    </header>
  );
}
