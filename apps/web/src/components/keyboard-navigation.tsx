"use client";

import { useKeyboardNav } from "@/hooks/use-keyboard-nav";
import { useTime } from "@/context/time-context";

/**
 * KeyboardNavigation - Wires keyboard shortcuts to time context.
 *
 * Shortcuts:
 * - [ = step back 1 hour
 * - ] = step forward 1 hour
 * - Shift+[ = step back 1 day
 * - Shift+] = step forward 1 day
 *
 * Event navigation (j/k/Enter) is stubbed for future implementation.
 */
export function KeyboardNavigation() {
  const { stepBack, stepForward, dayBack, dayForward } = useTime();

  useKeyboardNav({
    onNext: () => {}, // Event navigation (future)
    onPrev: () => {}, // Event navigation (future)
    onSelect: () => {}, // Event selection (future)
    onStepBack: stepBack,
    onStepForward: stepForward,
    onDayBack: dayBack,
    onDayForward: dayForward,
  });

  return null; // This component just sets up the listener
}
