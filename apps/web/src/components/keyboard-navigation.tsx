"use client";

import { useKeyboardNav } from "@/hooks/use-keyboard-nav";

export function KeyboardNavigation() {
  useKeyboardNav({
    onNext: () => {},
    onPrev: () => {},
    onSelect: () => {},
  });

  return null;
}
