"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ContextPanel } from "./context-panel";
import { MobileNav } from "./mobile-nav";
import { KeyboardNavigation } from "@/components/keyboard-navigation";
import { useSelection } from "@/context/selection-context";

interface ObservatoryShellProps {
  children: React.ReactNode;
}

export function ObservatoryShell({ children }: ObservatoryShellProps) {
  const [searchQuery, setSearchQuery] = useState("");
  // Temporary state for mobile navigation - will be replaced with context in Task 5
  const [activeTab, setActiveTab] = useState<"hn" | "github" | "arxiv">("hn");
  const { clearSelection } = useSelection();

  return (
    <div className="flex h-screen overflow-hidden">
      <KeyboardNavigation />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
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
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
