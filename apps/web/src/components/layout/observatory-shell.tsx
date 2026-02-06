"use client";

import { useState } from "react";
import { IconRail } from "./icon-rail";
import { BottomTabBar } from "./bottom-tab-bar";
import { Header } from "./header";
import { ContextPanel } from "./context-panel";
import { KeyboardNavigation } from "@/components/keyboard-navigation";
import { useSelection } from "@/context/selection-context";

interface ObservatoryShellProps {
  children: React.ReactNode;
}

export function ObservatoryShell({ children }: ObservatoryShellProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { clearSelection } = useSelection();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KeyboardNavigation />
      <IconRail />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
            {children}
          </div>
          <ContextPanel onClose={clearSelection} />
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
