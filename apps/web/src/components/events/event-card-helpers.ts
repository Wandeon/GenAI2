import { pickLatestArtifact } from "@genai/shared";

import type { WhatHappenedPayload, WhyMattersPayload } from "@genai/shared";
import type {
  ImpactLevel, ConfidenceLabel, SourceChip, EvidenceItem,
  SourceKind, TrustTier, UnifiedEventCardProps,
} from "./unified-event-card";

// Short display labels per source type
const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

// Maps source type to SourceKind category
const SOURCE_KIND_MAP: Record<string, SourceKind> = {
  NEWSAPI: "NEWS", ARXIV: "PAPER", HUGGINGFACE: "PAPER",
  GITHUB: "CODE", DEVTO: "CODE",
  HN: "DISCUSSION", REDDIT: "DISCUSSION", LOBSTERS: "DISCUSSION",
  PRODUCTHUNT: "TOOL", LEADERBOARD: "TOOL", YOUTUBE: "VIDEO",
};

// Domain to source type lookup
const DOMAIN_SOURCE_MAP: Record<string, string> = {
  "news.ycombinator.com": "HN", "github.com": "GITHUB",
  "arxiv.org": "ARXIV", "reddit.com": "REDDIT",
  "lobste.rs": "LOBSTERS", "producthunt.com": "PRODUCTHUNT",
  "dev.to": "DEVTO", "youtube.com": "YOUTUBE", "huggingface.co": "HUGGINGFACE",
};

// Input shapes (match the tRPC byId response)
interface ArtifactInput { type: string; payload: unknown; version: number }
interface EntityInput { id: string; name: string; nameHr?: string | null; type: string; role: string }
interface EvidenceInput { id: string; role: string; url: string; domain: string; trustTier: string; title: string | null }

interface EventInput {
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: string;
  sourceCount: number;
  confidence?: string | null;
  sourceType: string;
}

// Wire NormalizedEvent + artifacts + evidence into UnifiedEventCardProps
export function mapEventToCardProps(
  event: EventInput,
  artifacts: ArtifactInput[],
  entities: EntityInput[],
  evidence: EvidenceInput[],
  onOpen?: () => void,
): UnifiedEventCardProps {
  const occurredAtLabel = new Date(event.occurredAt).toLocaleDateString(
    "hr-HR", { day: "numeric", month: "short", year: "numeric" },
  );

  const mapped = artifacts.map((a) => ({
    type: a.type, payload: a.payload, version: a.version,
  }));

  const whatHappenedArtifact =
    pickLatestArtifact<WhatHappenedPayload>(mapped, "WHAT_HAPPENED");
  const whyMattersArtifact =
    pickLatestArtifact<WhyMattersPayload>(mapped, "WHY_MATTERS");

  const whatHappened =
    whatHappenedArtifact?.payload.hr || whatHappenedArtifact?.payload.en || undefined;
  const whyMatters =
    whyMattersArtifact?.payload.textHr || whyMattersArtifact?.payload.text || undefined;

  // Build source chips from evidence, deduplicated
  const sources = deduplicateSources(
    evidence.map((e) => {
      const st = domainToSourceType(e.domain);
      return {
        label: SOURCE_LABELS[st] || shortDomain(e.domain),
        kind: SOURCE_KIND_MAP[st] || ("NEWS" as SourceKind),
      };
    }),
  );

  // Ensure primary source type is represented
  const primaryLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
  if (!sources.some((s) => s.label === primaryLabel)) {
    sources.unshift({
      label: primaryLabel,
      kind: SOURCE_KIND_MAP[event.sourceType] || "NEWS",
    });
  }

  return {
    title: event.titleHr || event.title,
    occurredAtLabel,
    impactLevel: event.impactLevel as ImpactLevel,
    confidenceLabel: (event.confidence as ConfidenceLabel) ?? null,
    sourceCount: event.sourceCount,
    whatHappened,
    whyMatters,
    audienceTags: whyMattersArtifact?.payload.audience,
    sources,
    entities: entities.slice(0, 5).map((e) => ({
      id: e.id, name: e.nameHr || e.name, type: e.type,
    })),
    evidence: evidence.map((e) => ({
      id: e.id,
      trustTier: e.trustTier as TrustTier,
      domain: e.domain,
      role: e.role,
      title: e.title || e.domain,
      url: e.url,
    })),
    onOpen,
  };
}

function shortDomain(domain: string): string {
  return domain.replace(/^www\./, "").split(".")[0] || domain;
}

function domainToSourceType(domain: string): string {
  for (const [key, value] of Object.entries(DOMAIN_SOURCE_MAP)) {
    if (domain.includes(key)) return value;
  }
  return "";
}

function deduplicateSources(chips: SourceChip[]): SourceChip[] {
  const seen = new Set<string>();
  return chips.filter((c) => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });
}
