"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { trpc } from "@/trpc";

interface SelectionContextValue {
  // Currently selected event ID (from URL)
  selectedEventId: string | null;

  // Full event detail (from byId query)
  eventDetail: any | null;
  isDetailLoading: boolean;

  // Select an event (updates URL)
  selectEvent: (eventId: string) => void;

  // Clear selection (removes URL param)
  clearSelection: () => void;

  // Is context panel open on mobile?
  isContextOpen: boolean;
  setContextOpen: (open: boolean) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isContextOpen, setContextOpen] = useState(false);

  // URL is the single source of truth
  const selectedEventId = searchParams.get("event");

  // Fetch full event detail when ID is selected
  const { data: eventDetail, isLoading: isDetailLoading, error } = trpc.events.byId.useQuery(
    selectedEventId!,
    { enabled: !!selectedEventId }
  );

  // Guard against invalid event IDs - clear param if event not found
  useEffect(() => {
    if (selectedEventId && !isDetailLoading && error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("event");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }, [selectedEventId, isDetailLoading, error, searchParams, router, pathname]);

  // Auto-open mobile panel when event selected
  useEffect(() => {
    if (selectedEventId) {
      setContextOpen(true);
    }
  }, [selectedEventId]);

  const selectEvent = useCallback(
    (eventId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("event", eventId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("event");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setContextOpen(false);
  }, [searchParams, router, pathname]);

  const value = useMemo(
    () => ({
      selectedEventId,
      eventDetail: eventDetail ?? null,
      isDetailLoading,
      selectEvent,
      clearSelection,
      isContextOpen,
      setContextOpen,
    }),
    [selectedEventId, eventDetail, isDetailLoading, selectEvent, clearSelection, isContextOpen]
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
