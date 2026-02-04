"use client";

import { useState, useCallback } from "react";
import { cn } from "@genai/ui";

// ============================================================================
// TIME MACHINE SCRUBBER - Flagship UX mechanic
// ============================================================================
// A horizontal slider that lets users travel back in time to see
// the state of AI news at any point in the past 7 days.
//
// Key behaviors:
// - Drag left → Observatory animates to show state at that time
// - Events that hadn't happened yet fade out
// - Events that existed but weren't enriched show "raw" state
// - "Catch up" button appears: "Play 47 events at 2x speed"
// - Keyboard: [ and ] to step 1 hour, Shift+[ and Shift+] for 1 day

interface TimeMachineProps {
  /** Current scrubber value (0-100, 100 = now) */
  value?: number;
  /** Called when scrubber value changes */
  onChange?: (value: number) => void;
  /** Timestamp range in milliseconds */
  rangeMs?: number;
  /** Number of events that would be "played" to catch up */
  catchUpCount?: number;
  /** Whether we're in catch-up mode (from Daily Run) */
  isCatchUpMode?: boolean;
  /** Called when user clicks the catch-up play button */
  onCatchUpPlay?: () => void;
  /** Called when user exits catch-up mode */
  onExitCatchUp?: () => void;
}

export function TimeMachine({
  value = 100,
  onChange,
  rangeMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  catchUpCount = 0,
  isCatchUpMode = false,
  onCatchUpPlay,
  onExitCatchUp,
}: TimeMachineProps) {
  const [localValue, setLocalValue] = useState(value);
  const currentValue = onChange ? value : localValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value);
      if (onChange) {
        onChange(newValue);
      } else {
        setLocalValue(newValue);
      }
    },
    [onChange]
  );

  const handleJumpToNow = useCallback(() => {
    if (onChange) {
      onChange(100);
    } else {
      setLocalValue(100);
    }
  }, [onChange]);

  // Calculate the date at current scrubber position
  const now = Date.now();
  const targetTime = now - rangeMs * (1 - currentValue / 100);
  const targetDate = new Date(targetTime);

  const isInPast = currentValue < 100;

  return (
    <div className="space-y-2">
      {/* Time state indicator */}
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "text-sm font-mono",
            isInPast ? "text-amber-500" : "text-green-500"
          )}
        >
          {isInPast ? (
            <span>
              {targetDate.toLocaleDateString("hr-HR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
              <span aria-live="polite">UZIVO</span>
            </span>
          )}
        </div>

        {/* Jump to now button */}
        {isInPast && (
          <button
            onClick={handleJumpToNow}
            className="text-xs text-primary hover:underline min-h-[44px] px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            aria-label="Preskoci na trenutno vrijeme"
          >
            Skoci na sada
          </button>
        )}
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={100}
        value={currentValue}
        onChange={handleChange}
        className={cn(
          "w-full h-2 rounded-lg appearance-none cursor-pointer",
          isInPast ? "bg-amber-200 dark:bg-amber-900" : "bg-secondary"
        )}
        aria-label="Time machine scrubber"
      />

      {/* Labels */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>7 dana prije</span>
        <span className={isInPast ? "font-medium text-amber-500" : ""}>
          {isInPast ? targetDate.toLocaleDateString("hr-HR") : "SADA"}
        </span>
        <span>SADA</span>
      </div>

      {/* Catch up mode indicator */}
      {isCatchUpMode && (
        <div className="flex items-center justify-between bg-amber-100 dark:bg-amber-900/30 p-2 rounded-md">
          <span className="text-sm text-amber-700 dark:text-amber-300">
            Catch-up mod aktivan
          </span>
          {onExitCatchUp && (
            <button
              onClick={onExitCatchUp}
              className="text-xs text-amber-700 dark:text-amber-300 hover:underline min-h-[44px] px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded"
            >
              Izađi
            </button>
          )}
        </div>
      )}

      {/* Catch up button (shown when in the past) */}
      {isInPast && catchUpCount > 0 && (
        <div className="pt-2">
          <button
            onClick={onCatchUpPlay}
            className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={`Pusti ${catchUpCount} dogadaja dvostrukom brzinom`}
          >
            Pusti {catchUpCount} dogadaja (2x brzina)
          </button>
        </div>
      )}
    </div>
  );
}
