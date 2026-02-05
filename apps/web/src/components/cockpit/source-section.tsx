"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { NormalizedEvent } from "@genai/shared";
import { CockpitEventCard } from "./cockpit-event-card";

interface SourceConfig {
  key: string;
  label: string;
  icon: string;
  accentColor: string;
}

interface SourceSectionProps {
  title: string;
  icon: string;
  glowClass: string;
  sources: SourceConfig[];
  eventsBySource: Map<string, NormalizedEvent[]>;
  selectedEventId?: string;
  onSelectEvent: (event: NormalizedEvent) => void;
  isLoading?: boolean;
  delay?: number;
}

export function SourceSection({
  title,
  icon,
  glowClass,
  sources,
  eventsBySource,
  selectedEventId,
  onSelectEvent,
  isLoading,
  delay = 0,
}: SourceSectionProps) {
  const totalCount = sources.reduce(
    (sum, s) => sum + (eventsBySource.get(s.key)?.length ?? 0),
    0
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className={`glass-card rounded-2xl overflow-hidden ${glowClass}`}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-base tracking-wide">{title}</h2>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
          {totalCount}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse text-muted-foreground text-sm">
            Učitavanje...
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nema podataka iz ovih izvora
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {sources.map((source) => {
            const events = eventsBySource.get(source.key) ?? [];
            if (events.length === 0) return null;

            return (
              <div key={source.key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-sm">{source.icon}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {source.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${source.accentColor}`}
                  >
                    {events.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {events.map((event) => (
                    <CockpitEventCard
                      key={event.id}
                      id={event.id}
                      title={event.title}
                      titleHr={event.titleHr}
                      occurredAt={event.occurredAt}
                      impactLevel={event.impactLevel}
                      sourceCount={event.sourceCount}
                      topics={event.topics}
                      isSelected={selectedEventId === event.id}
                      onClick={() => onSelectEvent(event)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
