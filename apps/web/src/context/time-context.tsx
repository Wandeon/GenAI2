"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

interface TimeContextValue {
  // Current scrubber value (0-100, 100 = now)
  scrubberValue: number;
  setScrubberValue: (value: number) => void;

  // Computed timestamp from scrubber
  targetTimestamp: Date;

  // beforeTime for database queries (null = now, no filter needed)
  beforeTime: Date | null;

  // Time range (7 days)
  rangeMs: number;

  // Is at live/now position?
  isLive: boolean;

  // Is viewing the past?
  isInPast: boolean;

  // Number of events that would be "caught up" (missed events)
  catchUpCount: number;
  setCatchUpCount: (count: number) => void;

  // Step functions for keyboard nav
  stepBack: () => void; // 1 hour back
  stepForward: () => void; // 1 hour forward
  dayBack: () => void; // 1 day back
  dayForward: () => void; // 1 day forward
  jumpToNow: () => void; // Reset to now
}

const TimeContext = createContext<TimeContextValue | null>(null);

const RANGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const HOUR_STEP = (1 / (7 * 24)) * 100; // 1 hour as percentage of 7 days (~0.595%)
const DAY_STEP = (1 / 7) * 100; // 1 day as percentage of 7 days (~14.29%)

export function TimeProvider({ children }: { children: ReactNode }) {
  const [scrubberValue, setScrubberValue] = useState(100);
  const [catchUpCount, setCatchUpCount] = useState(0);

  const targetTimestamp = useMemo(() => {
    const now = Date.now();
    const offset = RANGE_MS * (1 - scrubberValue / 100);
    return new Date(now - offset);
  }, [scrubberValue]);

  // beforeTime for database queries - null when at "now" (no filter needed)
  const beforeTime = useMemo(() => {
    if (scrubberValue >= 100) return null;
    return targetTimestamp;
  }, [scrubberValue, targetTimestamp]);

  const isLive = scrubberValue >= 100;
  const isInPast = scrubberValue < 100;

  const stepBack = useCallback(() => {
    setScrubberValue((v) => Math.max(0, v - HOUR_STEP));
  }, []);

  const stepForward = useCallback(() => {
    setScrubberValue((v) => Math.min(100, v + HOUR_STEP));
  }, []);

  const dayBack = useCallback(() => {
    setScrubberValue((v) => Math.max(0, v - DAY_STEP));
  }, []);

  const dayForward = useCallback(() => {
    setScrubberValue((v) => Math.min(100, v + DAY_STEP));
  }, []);

  const jumpToNow = useCallback(() => {
    setScrubberValue(100);
  }, []);

  const value = useMemo(
    () => ({
      scrubberValue,
      setScrubberValue,
      targetTimestamp,
      beforeTime,
      rangeMs: RANGE_MS,
      isLive,
      isInPast,
      catchUpCount,
      setCatchUpCount,
      stepBack,
      stepForward,
      dayBack,
      dayForward,
      jumpToNow,
    }),
    [
      scrubberValue,
      targetTimestamp,
      beforeTime,
      isLive,
      isInPast,
      catchUpCount,
      stepBack,
      stepForward,
      dayBack,
      dayForward,
      jumpToNow,
    ]
  );

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTime() {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error("useTime must be used within a TimeProvider");
  }
  return context;
}
