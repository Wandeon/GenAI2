// ORCHESTRATOR COMPONENT: Coordinates multiple dossier sections in a single panel.
// Exceeds 300-line limit per CLAUDE.md exception for orchestrator components.
"use client";

import { useSelection } from "@/context/selection-context";
import { pickLatestArtifact } from "@genai/shared";
import type {
  HeadlinePayload,
  SummaryPayload,
  WhatHappenedPayload,
  WhyMattersPayload,
  GMTakePayload,
} from "@genai/shared/schemas/artifacts";

// ============================================================================
// TRUST TIER DISPLAY
// ============================================================================

const TRUST_TIER_BADGE: Record<string, { label: string; cls: string }> = {
  AUTHORITATIVE: { label: "Autoritativan", cls: "bg-emerald-500/20 text-emerald-400" },
  STANDARD: { label: "Standardan", cls: "bg-blue-500/20 text-blue-400" },
  LOW: { label: "Nizak", cls: "bg-gray-500/20 text-gray-400" },
};

const CONFIDENCE_BADGE: Record<string, { label: string; cls: string }> = {
  HIGH: { label: "Visoka", cls: "text-emerald-400" },
  MEDIUM: { label: "Srednja", cls: "text-amber-400" },
  LOW: { label: "Niska", cls: "text-red-400" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  RAW: { label: "Neobraden", cls: "bg-gray-500/20 text-gray-400" },
  ENRICHED: { label: "Obogacen", cls: "bg-blue-500/20 text-blue-400" },
  PUBLISHED: { label: "Objavljen", cls: "bg-emerald-500/20 text-emerald-400" },
  QUARANTINED: { label: "U karanteni", cls: "bg-amber-500/20 text-amber-400" },
};

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ContextPanelProps {
  onClose: () => void;
}

export function ContextPanel({ onClose }: ContextPanelProps) {
  const {
    selectedEventId,
    eventDetail,
    isDetailLoading,
    clearSelection,
    isContextOpen,
  } = useSelection();

  // Extract artifacts using pickLatestArtifact
  const artifacts = eventDetail?.artifacts ?? [];
  const headline = pickLatestArtifact<HeadlinePayload>(artifacts, "HEADLINE");
  const whatHappened = pickLatestArtifact<WhatHappenedPayload>(artifacts, "WHAT_HAPPENED");
  const summary = pickLatestArtifact<SummaryPayload>(artifacts, "SUMMARY");
  const whyMatters = pickLatestArtifact<WhyMattersPayload>(artifacts, "WHY_MATTERS");
  const gmTake = pickLatestArtifact<GMTakePayload>(artifacts, "GM_TAKE");

  // Count authoritative sources
  const authCount =
    eventDetail?.evidence?.filter((e: any) => e.trustTier === "AUTHORITATIVE").length ?? 0;

  // Determine if enrichment is partial
  const hasAllRequired = headline && whatHappened && summary && whyMatters;

  // ========================================================================
  // PANEL CONTENT
  // ========================================================================

  const panelContent = eventDetail ? (
    <div className="p-4 space-y-5">
      {/* Partial enrichment banner */}
      {!hasAllRequired && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          Obogacivanje u tijeku... Neki dijelovi jos nisu dostupni.
        </div>
      )}

      {/* HEADER: Headline + Meta */}
      <div>
        <h3 className="font-medium text-lg leading-snug">
          {headline?.payload.hr || eventDetail.titleHr || eventDetail.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
          <time>
            {new Date(eventDetail.occurredAt).toLocaleDateString("hr-HR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span>·</span>
          {eventDetail.status && STATUS_BADGE[eventDetail.status] && (
            <span className={`px-1.5 py-0.5 rounded ${STATUS_BADGE[eventDetail.status].cls}`}>
              {STATUS_BADGE[eventDetail.status].label}
            </span>
          )}
          <span>·</span>
          <span>{eventDetail.sourceCount} izvora</span>
          {authCount > 0 && (
            <>
              <span>·</span>
              <span className="text-emerald-400">{authCount} autoritativan</span>
            </>
          )}
          {eventDetail.confidence && CONFIDENCE_BADGE[eventDetail.confidence] && (
            <>
              <span>·</span>
              <span className={CONFIDENCE_BADGE[eventDetail.confidence].cls}>
                GM sigurnost: {CONFIDENCE_BADGE[eventDetail.confidence].label}
              </span>
            </>
          )}
        </div>
      </div>

      {/* WHAT HAPPENED */}
      {whatHappened && (
        <div>
          <SectionHeader>Sto se dogodilo</SectionHeader>
          <p className="text-sm leading-relaxed">{whatHappened.payload.hr}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {whatHappened.payload.sourceLine}
          </p>
          {whatHappened.payload.disagreements &&
            whatHappened.payload.disagreements.length > 0 && (
              <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-400 mb-1">
                  Izvori se ne slazu:
                </p>
                <ul className="text-xs text-amber-300 space-y-0.5">
                  {whatHappened.payload.disagreements.map((d: string, i: number) => (
                    <li key={i}>- {d}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}

      {/* SUMMARY */}
      {summary && (
        <div>
          <SectionHeader>Sazetak</SectionHeader>
          <p className="text-sm leading-relaxed">{summary.payload.hr}</p>
          {summary.payload.bulletPoints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {summary.payload.bulletPoints.map((bp: string, i: number) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                  {bp}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* WHY IT MATTERS */}
      {whyMatters && (
        <div>
          <SectionHeader>Zasto je vazno</SectionHeader>
          <p className="text-sm leading-relaxed">{whyMatters.payload.textHr}</p>
          <div className="flex gap-1 mt-2">
            {whyMatters.payload.audience.map((a: string) => (
              <span
                key={a}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GM TAKE */}
      <div>
        <SectionHeader>GM Analiza</SectionHeader>
        {gmTake ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm leading-relaxed italic">{gmTake.payload.takeHr}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>GM sigurnost: {gmTake.payload.confidence}</span>
            </div>
            {gmTake.payload.caveats && gmTake.payload.caveats.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {gmTake.payload.caveats.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    - {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            GM jos razmislja...
          </p>
        )}
      </div>

      {/* EVIDENCE CHAIN */}
      {eventDetail.evidence && eventDetail.evidence.length > 0 && (
        <div>
          <SectionHeader>Lanac dokaza</SectionHeader>
          <div className="space-y-2">
            {eventDetail.evidence.map((ev: any) => (
              <a
                key={ev.id}
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {ev.title || ev.domain}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {ev.domain}
                    </span>
                    {TRUST_TIER_BADGE[ev.trustTier] && (
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded ${TRUST_TIER_BADGE[ev.trustTier].cls}`}
                      >
                        {TRUST_TIER_BADGE[ev.trustTier].label}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {ev.role === "PRIMARY"
                        ? "Primarni"
                        : ev.role === "SUPPORTING"
                          ? "Potpora"
                          : "Kontekst"}
                    </span>
                  </div>
                </div>
                <span
                  className="text-muted-foreground text-xs group-hover:text-primary"
                  aria-hidden="true"
                >
                  &#8599;
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ENTITIES */}
      {eventDetail.entities && eventDetail.entities.length > 0 && (
        <div>
          <SectionHeader>Entiteti</SectionHeader>
          <div className="flex flex-wrap gap-1">
            {eventDetail.entities.map((ent: any) => (
              <span
                key={ent.id}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground"
              >
                {ent.nameHr || ent.name}
                <span className="ml-1 text-[10px] opacity-60">{ent.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* TOPICS */}
      {eventDetail.topics && eventDetail.topics.length > 0 && (
        <div>
          <SectionHeader>Teme</SectionHeader>
          <div className="flex flex-wrap gap-1">
            {eventDetail.topics.map((topic: string) => (
              <span key={topic} className="text-xs bg-secondary px-2 py-0.5 rounded">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  ) : selectedEventId && isDetailLoading ? (
    <div className="p-4 space-y-3">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
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

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <>
      {/* Desktop: sidebar panel */}
      <aside className="hidden xl:block w-80 border-l bg-card overflow-y-auto h-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Dosje</h2>
          {selectedEventId && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
              aria-label="Zatvori dosje"
            >
              <span aria-hidden="true">&#10005;</span>
            </button>
          )}
        </div>
        {panelContent}
      </aside>

      {/* Mobile: bottom sheet */}
      {isContextOpen && selectedEventId && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={clearSelection}
            aria-hidden="true"
          />
          <aside
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-xl z-50 max-h-[70vh] overflow-y-auto xl:hidden animate-in slide-in-from-bottom duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Dosje dogadaja"
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-card">
              <span className="font-medium">Dosje</span>
              <button
                onClick={clearSelection}
                className="p-2 rounded-full hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Zatvori dosje"
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
