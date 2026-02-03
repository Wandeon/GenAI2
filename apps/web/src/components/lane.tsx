"use client";

import { cn } from "@genai/ui";

// ============================================================================
// LANE - A vertical column in the Observatory glass cockpit
// ============================================================================
// Lanes display events filtered by topic, impact, or custom criteria.
// Multiple lanes create the "multi-lane glass cockpit" effect.

export interface LaneProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Number of events in this lane */
  count?: number;
  /** Whether this lane is loading */
  isLoading?: boolean;
}

export function Lane({
  title,
  icon,
  children,
  className,
  count,
  isLoading = false,
}: LaneProps) {
  return (
    <section
      className={cn(
        "flex flex-col h-full border rounded-lg overflow-hidden",
        className
      )}
    >
      {/* Lane header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold">{title}</h2>
          {typeof count === "number" && (
            <span className="text-sm text-muted-foreground">({count})</span>
          )}
        </div>
      </header>

      {/* Lane content - scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
