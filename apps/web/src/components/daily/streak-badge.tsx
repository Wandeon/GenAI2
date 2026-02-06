"use client";

import { useState, useEffect } from "react";

export function DailyStreakBadge() {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const KEY = "genai_daily_streak";
    const today = new Date().toISOString().slice(0, 10);

    try {
      const stored = JSON.parse(localStorage.getItem(KEY) || "{}");
      const lastVisit = stored.lastVisit as string | undefined;
      const count = (stored.count as number) || 0;

      if (lastVisit === today) {
        setStreak(count);
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const newCount = lastVisit === yesterdayStr ? count + 1 : 1;
      localStorage.setItem(
        KEY,
        JSON.stringify({ lastVisit: today, count: newCount })
      );
      setStreak(newCount);
    } catch {
      setStreak(1);
    }
  }, []);

  if (streak <= 1) return null;

  return (
    <span className="bg-amber-50 text-amber-700 font-mono text-xs px-2 py-0.5 rounded-full">
      {streak} dana zaredom
    </span>
  );
}
