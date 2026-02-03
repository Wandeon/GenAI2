"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ContextPanel } from "./context-panel";
import type { ImpactLevel } from "@/components/event-card";

interface SelectedEvent {
  id: string;
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics?: string[];
  summary?: string;
  summaryHr?: string;
}

interface ObservatoryShellProps {
  children: React.ReactNode;
}

export function ObservatoryShell({ children }: ObservatoryShellProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);

  const handleCloseContext = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
          <ContextPanel
            selectedEvent={selectedEvent}
            onClose={handleCloseContext}
          />
        </main>
      </div>
    </div>
  );
}
