"use client";

import { motion } from "framer-motion";

interface CockpitEventCardProps {
  id: string;
  title: string;
  titleHr?: string | null;
  occurredAt: Date;
  impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  topics?: string[];
  isSelected?: boolean;
  onClick?: () => void;
}

const impactDot: Record<string, string> = {
  BREAKING: "bg-red-500 shadow-red-500/50 shadow-lg",
  HIGH: "bg-orange-500 shadow-orange-500/50 shadow-lg",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-500",
};

export function CockpitEventCard({
  title,
  titleHr,
  occurredAt,
  impactLevel,
  sourceCount,
  topics,
  isSelected,
  onClick,
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
