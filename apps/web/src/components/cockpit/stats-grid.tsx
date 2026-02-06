"use client";

import { motion } from "framer-motion";

interface StatsGridProps {
  totalCount: number;
  newsCount: number;
  communityCount: number;
  researchCount: number;
  toolsCount: number;
  videoCount: number;
}

const stats = [
  { label: "Ukupno", key: "totalCount" as const, color: "text-foreground", icon: "📊" },
  { label: "Vijesti", key: "newsCount" as const, color: "text-foreground", icon: "📰" },
  { label: "Zajednica", key: "communityCount" as const, color: "text-foreground", icon: "💬" },
  { label: "Istraživanje", key: "researchCount" as const, color: "text-foreground", icon: "🔬" },
  { label: "Alati", key: "toolsCount" as const, color: "text-foreground", icon: "🛠" },
  { label: "Video", key: "videoCount" as const, color: "text-foreground", icon: "🎬" },
];

export function StatsGrid(props: StatsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 h-full">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
          className="bg-card border border-border rounded-lg p-3 flex flex-col items-center justify-center"
        >
          <span className="text-xl mb-0.5">{stat.icon}</span>
          <span className={`text-xl font-bold font-mono ${stat.color}`}>
            {props[stat.key]}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
