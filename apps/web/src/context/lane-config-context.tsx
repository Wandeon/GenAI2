"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

export type LaneId = "hn" | "github" | "arxiv" | "all" | "quarantine";

interface LaneConfig {
  id: LaneId;
  enabled: boolean;
  order: number;
}

interface LaneConfigContextValue {
  lanes: LaneConfig[];
  activeLanes: LaneId[];
  toggleLane: (id: LaneId) => void;
  reorderLanes: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
  isLaneEnabled: (id: LaneId) => boolean;
}

const LaneConfigContext = createContext<LaneConfigContextValue | null>(null);

const DEFAULT_LANES: LaneConfig[] = [
  { id: "hn", enabled: true, order: 0 },
  { id: "github", enabled: true, order: 1 },
  { id: "arxiv", enabled: true, order: 2 },
  { id: "all", enabled: false, order: 3 },
  { id: "quarantine", enabled: false, order: 4 },
];

const STORAGE_KEY = "genai-lane-config";

export function LaneConfigProvider({ children }: { children: ReactNode }) {
  const [lanes, setLanes] = useState<LaneConfig[]>(DEFAULT_LANES);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate the structure
        if (Array.isArray(parsed) && parsed.every((l) => l.id && typeof l.enabled === "boolean")) {
          setLanes(parsed);
        }
      }
    } catch {
      // Invalid JSON or access error, use defaults
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage on change (after hydration)
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes));
  }, [lanes, isHydrated]);

  const toggleLane = useCallback((id: LaneId) => {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id === id ? { ...lane, enabled: !lane.enabled } : lane
      )
    );
  }, []);

  const reorderLanes = useCallback((fromIndex: number, toIndex: number) => {
    setLanes((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(fromIndex, 1);
      sorted.splice(toIndex, 0, moved);
      return sorted.map((lane, i) => ({ ...lane, order: i }));
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setLanes(DEFAULT_LANES);
  }, []);

  const isLaneEnabled = useCallback(
    (id: LaneId) => {
      const lane = lanes.find((l) => l.id === id);
      return lane?.enabled ?? false;
    },
    [lanes]
  );

  const activeLanes = useMemo(
    () =>
      lanes
        .filter((l) => l.enabled)
        .sort((a, b) => a.order - b.order)
        .map((l) => l.id),
    [lanes]
  );

  const value = useMemo(
    () => ({
      lanes,
      activeLanes,
      toggleLane,
      reorderLanes,
      resetToDefault,
      isLaneEnabled,
    }),
    [lanes, activeLanes, toggleLane, reorderLanes, resetToDefault, isLaneEnabled]
  );

  return (
    <LaneConfigContext.Provider value={value}>
      {children}
    </LaneConfigContext.Provider>
  );
}

export function useLaneConfig() {
  const context = useContext(LaneConfigContext);
  if (!context) {
    throw new Error("useLaneConfig must be used within a LaneConfigProvider");
  }
  return context;
}
