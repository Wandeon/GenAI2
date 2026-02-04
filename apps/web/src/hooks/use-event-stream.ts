"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface EventStreamOptions {
  onNewEvent?: (eventId: string) => void;
  enabled?: boolean;
}

interface EventStreamState {
  isConnected: boolean;
  lastEventId: string | null;
  error: Error | null;
}

/**
 * Hook to subscribe to real-time event updates via SSE
 *
 * Automatically reconnects on disconnect and invalidates
 * relevant queries when new events arrive.
 */
export function useEventStream(options: EventStreamOptions = {}) {
  const { onNewEvent, enabled = true } = options;
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [state, setState] = useState<EventStreamState>({
    isConnected: false,
    lastEventId: null,
    error: null,
  });

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const url = `${apiUrl}/api/sse/events`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            // Initial connection message, no action needed
            return;
          }

          if (data.type === "new_event" && data.eventId) {
            setState((prev) => ({ ...prev, lastEventId: data.eventId }));

            // Invalidate events query to refetch with new event
            queryClient.invalidateQueries({ queryKey: ["events"] });

            // Call callback if provided
            onNewEvent?.(data.eventId);
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      eventSource.onerror = (e) => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: new Error("SSE connection error"),
        }));

        // Close and reconnect after delay
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after 5 seconds
        setTimeout(() => {
          if (enabled) {
            connect();
          }
        }, 5000);
      };
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: e instanceof Error ? e : new Error("Failed to connect"),
      }));
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, onNewEvent, queryClient]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
    };
  }, [connect]);

  // Disconnect when disabled
  useEffect(() => {
    if (!enabled && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, isConnected: false }));
    }
  }, [enabled]);

  return {
    isConnected: state.isConnected,
    lastEventId: state.lastEventId,
    error: state.error,
  };
}
