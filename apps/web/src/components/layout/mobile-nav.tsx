"use client";

import { cn } from "@genai/ui";
import { useMobileLane, type LaneId } from "@/context/mobile-lane-context";

const tabs: Array<{ id: LaneId; label: string; icon: string }> = [
  { id: "hn", label: "HN", icon: "🔶" },
  { id: "github", label: "GitHub", icon: "🐙" },
  { id: "arxiv", label: "Radovi", icon: "📄" },
];

export function MobileNav() {
  const { activeLane, setActiveLane } = useMobileLane();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t md:hidden z-50 pb-safe">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLane(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center py-3 text-xs min-h-[56px]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              activeLane === tab.id
                ? "text-primary"
                : "text-muted-foreground"
            )}
            aria-label={`Prebaci na ${tab.label}`}
            aria-pressed={activeLane === tab.id}
          >
            <span className="text-lg" aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
