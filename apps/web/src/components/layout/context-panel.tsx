"use client";

import { useSelection } from "@/context/selection-context";

interface ContextPanelProps {
  onClose: () => void;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { selectedEvent } = useSelection();
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              {new Date(selectedEvent.occurredAt).toLocaleDateString("hr-HR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {selectedEvent.sourceType && (
              <span className="text-xs text-muted-foreground">
                {selectedEvent.sourceType === "HN" && "🔶 Hacker News"}
                {selectedEvent.sourceType === "GITHUB" && "🐙 GitHub"}
                {selectedEvent.sourceType === "ARXIV" && "📄 arXiv"}
              </span>
            )}
          </div>
        </div>

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

        {selectedEvent.url && (
          <div className="pt-4 border-t">
            <a
              href={selectedEvent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <span>Pogledaj izvor</span>
              <span>↗</span>
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
