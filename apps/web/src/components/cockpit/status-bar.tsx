"use client";

import { motion } from "framer-motion";

interface StatusBarProps {
  eventCount: number;
  lastUpdate: Date | null;
  isLoading: boolean;
}

export function StatusBar({ eventCount, lastUpdate, isLoading }: StatusBarProps) {
  const timeAgo = lastUpdate
    ? getTimeAgo(lastUpdate)
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-header flex items-center justify-between px-6 py-3 rounded-xl"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-sm font-mono text-green-400 uppercase tracking-wider">
          Uživo
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">{isLoading ? "—" : eventCount}</span>
          <span>događaja</span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span>Zadnje ažuriranje:</span>
          <span className="font-mono text-foreground">{timeAgo}</span>
        </div>
      </div>
    </motion.div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "upravo sada";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours}h`;
  return `prije ${Math.floor(hours / 24)}d`;
}
