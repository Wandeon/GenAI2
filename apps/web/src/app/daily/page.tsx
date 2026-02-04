// Daily Run - Ritual briefing with GM commentary
// "What changed since you were gone" format
"use client";

import { AlertCircle, Calendar, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/trpc";

// Type for the briefing payload from GM
interface BriefingPayload {
  changedSince?: {
    en: string;
    hr: string;
    highlights: string[];
  };
  prediction?: {
    en: string;
    hr: string;
    confidence: "low" | "medium" | "high";
    caveats?: string[];
  };
  action?: {
    en: string;
    hr: string;
  };
  gmNote?: {
    en: string;
    hr: string;
  };
  eventCount: number;
  sourceCount: number;
  topEntities: string[];
}

// Type for event artifact payload
interface ArtifactPayload {
  en?: string;
  hr?: string;
}

// Map confidence level to Croatian
const confidenceLabels: Record<string, string> = {
  low: "niska",
  medium: "srednja",
  high: "visoka",
};

export default function DailyRunPage() {
  // Query today's briefing
  const { data: briefing, isLoading: briefingLoading } =
    trpc.dailyBriefings.today.useQuery();

  // Query catch-up info
  const { data: catchUp } = trpc.sessions.getCatchUp.useQuery();

  // Query full briefing with events if we have a briefing
  const { data: briefingWithEvents, isLoading: eventsLoading } =
    trpc.dailyBriefings.byIdWithEvents.useQuery(briefing?.id ?? "", {
      enabled: !!briefing?.id,
    });

  // Parse the payload (stored as JSON)
  const payload = briefing?.payload as BriefingPayload | undefined;

  // Loading state
  if (briefingLoading) {
    return (
      <div className="min-h-screen p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Format today's date in Croatian
  const todayFormatted = new Date().toLocaleDateString("hr-HR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Daily Run</h1>
        <p className="text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>GM</span>
          <span>•</span>
          <span>{payload?.sourceCount ?? 0} izvora</span>
          <span>•</span>
          <span>
            {payload?.prediction?.confidence
              ? `${confidenceLabels[payload.prediction.confidence]} pouzdanost`
              : "visoka pouzdanost"}
          </span>
        </p>
        <time className="text-sm text-muted-foreground">{todayFormatted}</time>
      </header>

      {!briefing ? (
        // No briefing state
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg">Današnji briefing još nije generiran</p>
          <p className="text-sm text-muted-foreground mt-2">
            Briefing se generira svaki dan u 06:00 CET
          </p>
        </div>
      ) : (
        <main className="space-y-8">
          {/* Top 5 events */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Ključni događaji
            </h2>
            <div className="space-y-3">
              {eventsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse p-4 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 bg-muted rounded" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : briefingWithEvents?.events?.length ? (
                briefingWithEvents.events.map(({ rank, event }) =>
                  event ? (
                    <Link
                      key={event.id}
                      href={`/observatory?event=${event.id}`}
                      className="block p-4 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg font-bold text-muted-foreground min-w-[1.5rem]">
                          {rank}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">
                            {event.titleHr || event.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {getSummary(event.artifacts)}
                          </p>
                          {event.mentions?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {event.mentions.slice(0, 3).map((m) => (
                                <span
                                  key={m.entity.id}
                                  className="text-xs bg-muted px-2 py-0.5 rounded"
                                >
                                  {m.entity.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  ) : null
                )
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nema ključnih događaja za danas
                </p>
              )}
            </div>
          </section>

          {/* What changed */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Što se promijenilo</h2>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-foreground">
                {payload?.changedSince?.hr || "Nema podataka o promjenama"}
              </p>
              {payload?.changedSince?.highlights &&
                payload.changedSince.highlights.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {payload.changedSince.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </section>

          {/* GM Prediction */}
          <section>
            <h2 className="text-xl font-semibold mb-4">GM Prognoza</h2>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-foreground">
                {payload?.prediction?.hr || "Nema prognoze za ovaj tjedan"}
              </p>
              {payload?.prediction?.confidence && (
                <p className="text-sm text-muted-foreground mt-2">
                  Pouzdanost: {confidenceLabels[payload.prediction.confidence]}
                </p>
              )}
              {payload?.prediction?.caveats &&
                payload.prediction.caveats.length > 0 && (
                  <div className="mt-3 p-3 bg-muted rounded text-sm">
                    <p className="font-medium mb-1">Napomene:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {payload.prediction.caveats.map((caveat, i) => (
                        <li key={i}>{caveat}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </section>

          {/* GM Note (if exists) */}
          {payload?.gmNote?.hr && (
            <section>
              <h2 className="text-xl font-semibold mb-4">GM Poruka</h2>
              <div className="p-4 rounded-lg bg-card border italic">
                <p className="text-foreground">{payload.gmNote.hr}</p>
              </div>
            </section>
          )}

          {/* Source disclosure */}
          <section className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Ovaj briefing generirao je GM na temelju{" "}
              <strong>{payload?.eventCount ?? 0} događaja</strong> iz{" "}
              <strong>{payload?.sourceCount ?? 0} izvora</strong>.
              {payload?.topEntities && payload.topEntities.length > 0 && (
                <> Najčešće spominjani: {payload.topEntities.join(", ")}.</>
              )}
            </p>
          </section>

          {/* Catch up button */}
          {catchUp && catchUp.count > 0 && (
            <div className="pt-4">
              <Link
                href={`/observatory?catchUp=${catchUp.since?.toISOString()}`}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                <Clock className="w-4 h-4" />
                Pusti {catchUp.count} događaja (2x brzina)
              </Link>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// Helper to extract summary from artifacts
function getSummary(
  artifacts: Array<{ artifactType: string; payload: unknown }> | undefined
): string {
  if (!artifacts) return "";
  const summaryArtifact = artifacts.find((a) => a.artifactType === "SUMMARY");
  if (summaryArtifact) {
    const payload = summaryArtifact.payload as ArtifactPayload;
    const text = payload?.hr || payload?.en || "";
    return text.length > 150 ? text.slice(0, 150) + "..." : text;
  }
  const headlineArtifact = artifacts.find((a) => a.artifactType === "HEADLINE");
  if (headlineArtifact) {
    const payload = headlineArtifact.payload as ArtifactPayload;
    return payload?.hr || payload?.en || "";
  }
  return "";
}
