"use client";

import {
  Suspense,
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
  selectedEventId: string | null;
  eventDetail: any | null;
  isDetailLoading: boolean;
  selectEvent: (eventId: string) => void;
  clearSelection: () => void;
  isContextOpen: boolean;
  setContextOpen: (open: boolean) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

function SelectionProviderInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isContextOpen, setContextOpen] = useState(false);

  const selectedEventId = searchParams.get("event");

  const { data: eventDetail, isLoading: isDetailLoading, error } = trpc.events.byId.useQuery(
    selectedEventId!,
    { enabled: !!selectedEventId }
  );

  useEffect(() => {
    if (selectedEventId && !isDetailLoading && error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("event");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
  }, [selectedEventId, isDetailLoading, error, searchParams, router, pathname]);

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

export function SelectionProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SelectionProviderInner>{children}</SelectionProviderInner>
    </Suspense>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within a SelectionProvider");
  }
  return context;
}
