"use client";

import { useState, useCallback } from "react";

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
}

export function TimeMachine({
  value = 100,
  onChange,
  rangeMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  catchUpCount = 0,
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

  // Calculate the date at current scrubber position
  const now = Date.now();
  const targetTime = now - rangeMs * (1 - currentValue / 100);
  const targetDate = new Date(targetTime);

  const isInPast = currentValue < 100;

  return (
    <div className="space-y-2">
      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={100}
        value={currentValue}
        onChange={handleChange}
        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
        aria-label="Time machine scrubber"
      />

      {/* Labels */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>7 dana prije</span>
        <span className={isInPast ? "font-medium text-foreground" : ""}>
          {isInPast ? targetDate.toLocaleDateString("hr-HR") : "SADA"}
        </span>
        <span>SADA</span>
      </div>

      {/* Catch up button (shown when in the past) */}
      {isInPast && catchUpCount > 0 && (
        <div className="pt-2">
          <button className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md">
            Pusti {catchUpCount} događaja (2x brzina)
          </button>
        </div>
      )}
    </div>
  );
}
