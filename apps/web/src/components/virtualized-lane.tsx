"use client";

import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@genai/ui";

// ============================================================================
// VIRTUALIZED LANE - Efficient rendering for large event lists
// ============================================================================
// Uses @tanstack/react-virtual for windowing to handle 1000+ events smoothly.
// Only renders items currently visible in the viewport plus overscan buffer.

export interface VirtualizedLaneProps<T> {
  title: string;
  icon?: ReactNode;
  className?: string;
  count?: number;
  isLoading?: boolean;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize?: number;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualizedLane<T>({
  title,
  icon,
  className,
  count,
  isLoading = false,
  items,
  renderItem,
  estimateSize = 100,
  overscan = 5,
  getItemKey,
}: VirtualizedLaneProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

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
          {icon && <span aria-hidden="true">{icon}</span>}
          <h2 className="font-semibold">{title}</h2>
          {typeof count === "number" && (
            <span className="text-sm text-muted-foreground">({count})</span>
          )}
        </div>
      </header>

      {/* Lane content - virtualized scrollable */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        style={{ contain: "strict" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nema događaja
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualItem) => {
              const item = items[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="p-2"
                >
                  {renderItem(item, virtualItem.index)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
