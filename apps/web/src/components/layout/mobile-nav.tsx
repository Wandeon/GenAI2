"use client";

import { cn } from "@genai/ui";

interface MobileNavProps {
  activeTab: "hn" | "github" | "arxiv";
  onTabChange: (tab: "hn" | "github" | "arxiv") => void;
}

const tabs = [
  { id: "hn" as const, label: "HN", icon: "🔶" },
  { id: "github" as const, label: "GitHub", icon: "🐙" },
  { id: "arxiv" as const, label: "Radovi", icon: "📄" },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t md:hidden z-50 pb-safe">
      <div className="flex justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center py-3 text-xs min-h-[56px]",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground"
            )}
            aria-label={`Switch to ${tab.label}`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
