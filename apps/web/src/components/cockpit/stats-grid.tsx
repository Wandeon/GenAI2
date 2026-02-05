"use client";

import { motion } from "framer-motion";

interface StatsGridProps {
  hnCount: number;
  ghCount: number;
  arxivCount: number;
  totalCount: number;
}

const stats = [
  { label: "Ukupno", key: "totalCount" as const, color: "text-blue-400", icon: "📊" },
  { label: "Hacker News", key: "hnCount" as const, color: "text-orange-400", icon: "🔶" },
  { label: "GitHub", key: "ghCount" as const, color: "text-purple-400", icon: "🐙" },
  { label: "arXiv", key: "arxivCount" as const, color: "text-green-400", icon: "📄" },
];

export function StatsGrid(props: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
          className="glass-card rounded-xl p-4 flex flex-col items-center justify-center"
        >
          <span className="text-2xl mb-1">{stat.icon}</span>
          <span className={`text-2xl font-bold font-mono ${stat.color}`}>
            {props[stat.key]}
          </span>
          <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
