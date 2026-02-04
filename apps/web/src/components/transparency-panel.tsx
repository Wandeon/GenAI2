"use client";

import { trpc } from "@/trpc";

interface TransparencyPanelProps {
  eventId: string;
}

/**
 * GM Transparency Panel
 *
 * Shows the LLM processing details for an event:
 * - Total cost
 * - Total latency
 * - Source count
 * - Artifacts generated
 * - Individual LLM calls with model, tokens, cost
 * - Evidence sources with trust tier
 */
export function TransparencyPanel({ eventId }: TransparencyPanelProps) {
  const { data: event, isLoading: eventLoading } = trpc.events.byId.useQuery(eventId);
  const { data: llmRuns, isLoading: runsLoading } = trpc.llmRuns.byEventId.useQuery(eventId);

  if (eventLoading || runsLoading) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const totalCost = llmRuns?.reduce((sum, run) => sum + run.costCents, 0) || 0;
  const totalLatency = llmRuns?.reduce((sum, run) => sum + run.latencyMs, 0) || 0;
  const totalTokens = llmRuns?.reduce(
    (sum, run) => sum + run.inputTokens + run.outputTokens,
    0
  ) || 0;

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h4 className="text-sm font-medium mb-3">GM Transparency</h4>

      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-muted rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">Trošak</div>
          <div className="font-mono text-sm">${(totalCost / 100).toFixed(4)}</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">Latencija</div>
          <div className="font-mono text-sm">{totalLatency}ms</div>
        </div>
        <div className="bg-muted rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">Izvori</div>
          <div className="font-mono text-sm">{event.evidence?.length || 0}</div>
        </div>
      </div>

      {/* Artifacts */}
      {event.artifacts && event.artifacts.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">
            Artefakti ({event.artifacts.length})
          </h5>
          <div className="space-y-1">
            {event.artifacts.map((artifact, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
              >
                <span className="font-medium">{formatArtifactType(artifact.type)}</span>
                <span className="text-muted-foreground">
                  {artifact.modelUsed} • v{artifact.version}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LLM Calls */}
      {llmRuns && llmRuns.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-muted-foreground mb-2">
            LLM Pozivi ({llmRuns.length})
          </h5>
          <div className="space-y-2">
            {llmRuns.map((run) => (
              <div key={run.id} className="text-xs bg-muted/50 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{run.processorName}</span>
                  <span className="font-mono">${(run.costCents / 100).toFixed(4)}</span>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-2">
                  <span>{run.model}</span>
                  <span>•</span>
                  <span>{run.inputTokens}→{run.outputTokens} tokena</span>
                  <span>•</span>
                  <span>{run.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Sources */}
      {event.evidence && event.evidence.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-muted-foreground mb-2">
            Dokazi ({event.evidence.length})
          </h5>
          <div className="space-y-1">
            {event.evidence.map((e) => (
              <a
                key={e.id}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1 hover:bg-muted transition-colors"
              >
                <span className="text-blue-500 hover:underline truncate max-w-[70%]">
                  {e.domain}
                </span>
                <span className={getTrustTierColor(e.trustTier)}>
                  {formatTrustTier(e.trustTier)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Token Usage Summary */}
      {totalTokens > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          Ukupno: {totalTokens.toLocaleString()} tokena
        </div>
      )}
    </div>
  );
}

function formatArtifactType(type: string): string {
  const map: Record<string, string> = {
    HEADLINE: "Naslov",
    SUMMARY: "Sažetak",
    GM_TAKE: "GM Mišljenje",
    WHY_MATTERS: "Zašto je važno",
    ENTITY_EXTRACT: "Entiteti",
    TOPIC_ASSIGN: "Teme",
    RELATIONSHIP_EXTRACT: "Veze",
  };
  return map[type] || type;
}

function formatTrustTier(tier: string): string {
  const map: Record<string, string> = {
    AUTHORITATIVE: "Službeni",
    STANDARD: "Standardni",
    LOW: "Nizak",
  };
  return map[tier] || tier;
}

function getTrustTierColor(tier: string): string {
  const colors: Record<string, string> = {
    AUTHORITATIVE: "text-green-600",
    STANDARD: "text-blue-600",
    LOW: "text-yellow-600",
  };
  return colors[tier] || "text-muted-foreground";
}
