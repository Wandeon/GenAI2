"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

type LaneId = "hn" | "github" | "arxiv";

interface MobileLaneContextValue {
  activeLane: LaneId;
  setActiveLane: (lane: LaneId) => void;
}

const MobileLaneContext = createContext<MobileLaneContextValue | null>(null);

export function MobileLaneProvider({ children }: { children: ReactNode }) {
  const [activeLane, setActiveLane] = useState<LaneId>("hn");

  const value = useMemo(() => ({ activeLane, setActiveLane }), [activeLane]);

  return (
    <MobileLaneContext.Provider value={value}>
      {children}
    </MobileLaneContext.Provider>
  );
}

export function useMobileLane() {
  const context = useContext(MobileLaneContext);
  if (!context) {
    throw new Error("useMobileLane must be used within a MobileLaneProvider");
  }
  return context;
}

export type { LaneId };
