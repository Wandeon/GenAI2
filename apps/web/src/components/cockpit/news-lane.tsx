"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface NewsLaneProps {
  title: string;
  icon: ReactNode;
  count: number;
  accentColor: string;
  glowClass: string;
  children: ReactNode;
  isLoading?: boolean;
  delay?: number;
}

export function NewsLane({
  title,
  icon,
  count,
  accentColor,
  glowClass,
  children,
  isLoading,
  delay = 0,
}: NewsLaneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={`glass-card rounded-2xl flex flex-col h-full overflow-hidden ${glowClass}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-sm tracking-wide">{title}</h2>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${accentColor}`}>
          {count}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground text-sm">Učitavanje...</div>
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}
