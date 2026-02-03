"use client";

import { useSelection } from "@/context/selection-context";

interface ContextPanelProps {
  onClose: () => void;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const { selectedEvent, isContextOpen, clearSelection } = useSelection();

  // Desktop content (reusable panel content)
  const panelContent = selectedEvent ? (
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
            <span aria-hidden="true">&#8599;</span>
          </a>
        </div>
      )}
    </div>
  ) : (
    <div className="p-4">
      <p className="text-muted-foreground text-sm">
        Odaberi dogadaj za prikaz detalja
      </p>
      <p className="text-muted-foreground text-xs mt-2">
        Tipke: j/k za navigaciju, Enter za odabir
      </p>
    </div>
  );

  return (
    <>
      {/* Desktop: sidebar panel */}
      <aside className="hidden xl:block w-80 border-l bg-card overflow-y-auto h-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Detalji</h2>
          {selectedEvent && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
              aria-label="Zatvori panel s detaljima"
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          )}
        </div>
        {panelContent}
      </aside>

      {/* Mobile: bottom sheet */}
      {isContextOpen && selectedEvent && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={clearSelection}
            aria-hidden="true"
          />
          {/* Sheet */}
          <aside
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-xl z-50 max-h-[70vh] overflow-y-auto xl:hidden animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Detalji dogadaja"
          >
            {/* Close button */}
            <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-card">
              <span className="font-medium" id="sheet-title">Detalji</span>
              <button
                onClick={clearSelection}
                className="p-2 rounded-full hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Zatvori panel s detaljima"
              >
                <span aria-hidden="true">&#10005;</span>
              </button>
            </div>
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
