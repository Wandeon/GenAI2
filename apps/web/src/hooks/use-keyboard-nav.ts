"use client";

import { useEffect, useCallback } from "react";

interface UseKeyboardNavOptions {
  onNext: () => void;
  onPrev: () => void;
  onSelect: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onDayBack: () => void;
  onDayForward: () => void;
}

export function useKeyboardNav({
  onNext,
  onPrev,
  onSelect,
  onStepBack,
  onStepForward,
  onDayBack,
  onDayForward,
}: UseKeyboardNavOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
          onNext();
          break;
        case "k":
          onPrev();
          break;
        case "Enter":
          onSelect();
          break;
        case "[":
          if (e.shiftKey) {
            onDayBack();
          } else {
            onStepBack();
          }
          break;
        case "]":
          if (e.shiftKey) {
            onDayForward();
          } else {
            onStepForward();
          }
          break;
      }
    },
    [onNext, onPrev, onSelect, onStepBack, onStepForward, onDayBack, onDayForward]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
