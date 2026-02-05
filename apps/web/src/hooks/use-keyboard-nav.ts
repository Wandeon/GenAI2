"use client";

import { useEffect, useCallback } from "react";

interface UseKeyboardNavOptions {
  onNext: () => void;
  onPrev: () => void;
  onSelect: () => void;
}

export function useKeyboardNav({
  onNext,
  onPrev,
  onSelect,
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
      }
    },
    [onNext, onPrev, onSelect]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
