"use client";

import type { ImpactLevel } from "@/components/event-card";

interface ContextPanelProps {
  selectedEvent: {
    id: string;
    title: string;
    titleHr?: string;
    occurredAt: Date;
    impactLevel: ImpactLevel;
    sourceCount: number;
    topics?: string[];
    summary?: string;
    summaryHr?: string;
  } | null;
  onClose: () => void;
}

export function ContextPanel({ selectedEvent, onClose }: ContextPanelProps) {
  if (!selectedEvent) {
    return (
      <aside className="w-80 border-l bg-card p-4 hidden xl:block">
        <p className="text-muted-foreground text-sm">
          Odaberi dogadaj za prikaz detalja
        </p>
        <p className="text-muted-foreground text-xs mt-2">
          Tipke: j/k za navigaciju, Enter za odabir
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l bg-card hidden xl:block overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Detalji</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Zatvori"
        >
          ✕
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-lg">
            {selectedEvent.titleHr || selectedEvent.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedEvent.occurredAt.toLocaleDateString("hr-HR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {(selectedEvent.summaryHr || selectedEvent.summary) && (
          <div>
            <h4 className="text-sm font-medium mb-1">Sazetak</h4>
            <p className="text-sm text-muted-foreground">
              {selectedEvent.summaryHr || selectedEvent.summary}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-1">Izvori</h4>
          <p className="text-sm text-muted-foreground">
            {selectedEvent.sourceCount} izvora
          </p>
        </div>

        {selectedEvent.topics && selectedEvent.topics.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Teme</h4>
            <div className="flex flex-wrap gap-1">
              {selectedEvent.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-xs bg-secondary px-2 py-0.5 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
