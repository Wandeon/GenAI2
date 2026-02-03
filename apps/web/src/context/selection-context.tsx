"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { NormalizedEvent } from "@genai/shared";

interface SelectionContextValue {
  // Currently selected event (full data)
  selectedEvent: NormalizedEvent | null;

  // Select an event
  selectEvent: (event: NormalizedEvent) => void;

  // Clear selection
  clearSelection: () => void;

  // Is context panel open on mobile?
  isContextOpen: boolean;
  setContextOpen: (open: boolean) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedEvent, setSelectedEvent] = useState<NormalizedEvent | null>(null);
  const [isContextOpen, setContextOpen] = useState(false);

  const selectEvent = useCallback((event: NormalizedEvent) => {
    setSelectedEvent(event);
    setContextOpen(true); // Auto-open context on mobile when selecting
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEvent(null);
    setContextOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      selectedEvent,
      selectEvent,
      clearSelection,
      isContextOpen,
      setContextOpen,
    }),
    [selectedEvent, selectEvent, clearSelection, isContextOpen]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
