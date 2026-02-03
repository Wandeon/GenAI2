"use client";

import { cn } from "@genai/ui";

// ============================================================================
// EVENT CARD - Displays a single event in the Observatory lanes
// ============================================================================

export type ImpactLevel = "BREAKING" | "HIGH" | "MEDIUM" | "LOW";

export interface EventCardProps {
  id: string;
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics?: string[];
  isSelected?: boolean;
  onClick?: () => void;
}

const impactColors: Record<ImpactLevel, string> = {
  BREAKING: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  HIGH: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  MEDIUM: "border-l-blue-500",
  LOW: "border-l-gray-300",
};

export function EventCard({
  title,
  titleHr,
  occurredAt,
  impactLevel,
  sourceCount,
  topics = [],
  isSelected = false,
  onClick,
}: EventCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <article
      className={cn(
        "border-l-4 rounded-r-lg p-4 cursor-pointer min-h-[44px]",
        "transition-all duration-300 ease-in-out",
        "animate-in fade-in-0 slide-in-from-bottom-2",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        impactColors[impactLevel],
        isSelected && "ring-2 ring-primary",
        "hover:bg-accent/50"
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${titleHr || title}, ${impactLevel} impact, ${occurredAt.toLocaleDateString("hr-HR")}, ${sourceCount} izvora`}
    >
      {/* Title */}
      <h3 className="font-medium mb-1">{titleHr || title}</h3>

      {/* Metadata row */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <time dateTime={occurredAt.toISOString()}>
          {occurredAt.toLocaleDateString("hr-HR")}
        </time>
        <span>•</span>
        <span>{sourceCount} izvora</span>
      </div>

      {/* Topics */}
      {topics.length > 0 && (
        <div className="flex gap-1 mt-2">
          {topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="text-xs bg-secondary px-2 py-0.5 rounded"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
