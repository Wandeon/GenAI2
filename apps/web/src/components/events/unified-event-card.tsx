"use client";

import { useState } from "react";
import { cn } from "@genai/ui";

// ============================================================================
// Types
// ============================================================================

export type ImpactLevel = "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";
export type SourceKind = "NEWS" | "PAPER" | "CODE" | "DISCUSSION" | "TOOL" | "VIDEO";
export type TrustTier = "AUTHORITATIVE" | "STANDARD" | "LOW";

export interface SourceChip {
  label: string;
  kind: SourceKind;
}

export interface EvidenceItem {
  id: string;
  trustTier: TrustTier;
  domain: string;
  role: string;
  title: string;
  url: string;
}

export interface UnifiedEventCardProps {
  title: string;
  occurredAtLabel: string;
  impactLevel: ImpactLevel;
  confidenceLabel: ConfidenceLabel | null;
  sourceCount: number;
  whatHappened?: string;
  whyMatters?: string;
  audienceTags?: string[];
  sources?: SourceChip[];
  entities?: Array<{ id: string; name: string; type: string }>;
  evidence?: EvidenceItem[];
  onOpen?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const IMPACT_BORDER: Record<ImpactLevel, string> = {
  BREAKING: "border-l-red-500",
  HIGH: "border-l-amber-500",
  MEDIUM: "border-l-emerald-500",
  LOW: "border-l-zinc-300",
};

const IMPACT_DOT: Record<ImpactLevel, string> = {
  BREAKING: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-emerald-500",
  LOW: "bg-zinc-300",
};

const TRUST_DOT: Record<TrustTier, string> = {
  AUTHORITATIVE: "bg-emerald-500",
  STANDARD: "bg-amber-500",
  LOW: "bg-zinc-300",
};

const KIND_LABELS: Record<SourceKind, string> = {
  NEWS: "Vijesti",
  PAPER: "Rad",
  CODE: "Kod",
  DISCUSSION: "Rasprava",
  TOOL: "Alat",
  VIDEO: "Video",
};

function sourceCountLabel(n: number): string {
  return n === 1 ? "izvor" : "izvora";
}

// ============================================================================
// UnifiedEventCard
// ============================================================================

export function UnifiedEventCard({
  title,
  occurredAtLabel,
  impactLevel,
  confidenceLabel,
  sourceCount,
  whatHappened,
  whyMatters,
  audienceTags,
  sources,
  entities,
  evidence,
  onOpen,
}: UnifiedEventCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <article
      className={cn(
        "border-l-4 rounded-r-lg bg-white p-4",
        "transition-shadow hover:shadow-sm",
        IMPACT_BORDER[impactLevel],
      )}
    >
      {/* Header row: title + open action */}
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2 cursor-pointer"
          onClick={onOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpen?.();
          }}
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
        >
          {title}
        </h3>
      </div>

      {/* Meta row: time, impact badge, confidence, source count */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <time className="font-mono">{occurredAtLabel}</time>
        <ImpactBadge level={impactLevel} />
        {confidenceLabel && <ConfidencePill label={confidenceLabel} />}
        <span className="font-mono bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded">
          {sourceCount} {sourceCountLabel(sourceCount)}
        </span>
      </div>

      {/* What happened / Why matters */}
      {whatHappened && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="font-bold">{"Sto se dogodilo: "}</span>
          {whatHappened}
        </p>
      )}
      {whyMatters && (
        <p className="mt-1.5 text-sm leading-relaxed">
          <span className="font-bold">{"Zasto je vazno: "}</span>
          {whyMatters}
        </p>
      )}

      {/* Audience tags + entity chips */}
      {((audienceTags && audienceTags.length > 0) ||
        (entities && entities.length > 0)) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {audienceTags?.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600"
            >
              {tag}
            </span>
          ))}
          {entities?.map((e) => (
            <span
              key={e.id}
              className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-stone-300 text-stone-600"
            >
              {e.name}
            </span>
          ))}
        </div>
      )}

      {/* Source badges */}
      {sources && sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sources.map((s, i) => (
            <span
              key={`${s.label}-${i}`}
              className="font-mono text-[11px] bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded"
              title={KIND_LABELS[s.kind]}
            >
              [{s.label}]
            </span>
          ))}
        </div>
      )}

      {/* Evidence expander */}
      {evidence && evidence.length > 0 && (
        <div className="mt-3 border-t border-stone-200 pt-2">
          <button
            onClick={() => setEvidenceOpen((prev) => !prev)}
            className="text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors min-h-[44px] flex items-center"
          >
            {evidenceOpen ? "Sakrij" : `Izvori (${evidence.length})`}
          </button>
          {evidenceOpen && (
            <ul className="mt-1.5 space-y-1.5">
              {evidence.map((item) => (
                <EvidenceRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ImpactBadge({ level }: { level: ImpactLevel }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded bg-stone-100">
      <span className={cn("w-1.5 h-1.5 rounded-full", IMPACT_DOT[level])} />
      {level}
    </span>
  );
}

function ConfidencePill({ label }: { label: ConfidenceLabel }) {
  return (
    <span className="font-mono text-[11px] bg-zinc-800 text-zinc-100 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn("mt-1 w-2 h-2 rounded-full shrink-0", TRUST_DOT[item.trustTier])}
        title={item.trustTier}
      />
      <div className="min-w-0">
        <span className="text-muted-foreground">{item.domain}</span>
        <span className="mx-1 text-stone-300" aria-hidden="true">
          &middot;
        </span>
        <span className="text-muted-foreground">{item.role}</span>
        <br />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline line-clamp-1"
        >
          {item.title}
        </a>
      </div>
    </li>
  );
}
