"use client";

import { motion } from "framer-motion";

interface CockpitEventCardProps {
  id: string;
  title: string;
  titleHr?: string | null;
  occurredAt: Date;
  impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | null;
  topics?: string[];
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

const impactDot: Record<string, string> = {
  BREAKING: "bg-red-500 shadow-red-500/50 shadow-lg",
  HIGH: "bg-orange-500 shadow-orange-500/50 shadow-lg",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-500",
};

const confidenceBadge: Record<string, { dot: string; label: string; text: string }> = {
  HIGH: { dot: "bg-emerald-500", label: "HIGH", text: "text-emerald-400" },
  MEDIUM: { dot: "bg-amber-500", label: "MEDIUM", text: "text-amber-400" },
  LOW: { dot: "bg-red-500", label: "LOW", text: "text-red-400" },
};

export function CockpitEventCard({
  title,
  titleHr,
  occurredAt,
  impactLevel,
  sourceCount,
  confidence,
  topics,
  isSelected,
  onClick,
  onMouseEnter,
}: CockpitEventCardProps) {
  const displayTitle = titleHr || title;
  const timeStr = new Date(occurredAt).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-transparent hover:border-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${impactDot[impactLevel]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {displayTitle}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{timeStr}</span>
            {sourceCount > 1 && (
              <>
                <span>·</span>
                <span>{sourceCount} izvora</span>
              </>
            )}
            {confidence && confidenceBadge[confidence] && (
              <>
                <span>·</span>
                <span className={`flex items-center gap-1 ${confidenceBadge[confidence].text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${confidenceBadge[confidence].dot}`} />
                  {confidenceBadge[confidence].label}
                </span>
              </>
            )}
          </div>
          {topics && topics.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {topics.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
