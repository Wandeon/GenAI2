# Mobile-First Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform GenAI Observatory from a dark glassmorphic desktop dashboard to a light, mobile-first "morning paper" experience with Geist fonts, warm-mono palette, and amber accents.

**Architecture:** Visual reskin only — no data layer changes. Replace dark theme CSS variables with light warm-mono palette, swap system fonts for Geist Sans + Geist Mono, replace desktop sidebar with mobile-first bottom tabs + desktop icon rail, rebuild Daily page as ranked accordion list, add Live feed route. All tRPC queries, Prisma schema, and worker pipeline stay untouched.

**Tech Stack:** Next.js 16, Tailwind CSS v4, `geist` npm package for fonts, `next/font`, Lucide icons, framer-motion (existing)

**Design spec:** `docs/plans/2026-02-06-mobile-first-redesign.md`

**Branch:** `feat/mobile-first-redesign` (worktree at `.worktrees/mobile-redesign`)

---

## Commit 1: `chore(web): add geist font package and configure fonts`

### Files:
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/layout.tsx`

### Step 1: Install geist font package

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm add geist --filter=@genai/web
```

### Step 2: Update root layout with Geist fonts

Replace `apps/web/src/app/layout.tsx` entirely:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { TRPCProvider } from "@/trpc";

export const metadata: Metadata = {
  title: "GenAI Observatory",
  description: "World State AI Observatory - Real-time intelligence on AI developments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
```

Key changes:
- Remove `className="dark"` (light mode only now)
- Add Geist font CSS variables via `GeistSans.variable` + `GeistMono.variable`
- Body uses `font-sans` which will map to Geist Sans via CSS variables

### Step 3: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 4: Commit

```bash
git add apps/web/package.json apps/web/src/app/layout.tsx pnpm-lock.yaml
git commit -m "chore(web): add geist font package and configure fonts"
```

---

## Commit 2: `style(web): replace dark glassmorphism theme with light warm-mono palette`

### Files:
- Modify: `apps/web/src/app/globals.css`

### Step 1: Replace globals.css entirely

```css
@import "tailwindcss";

/* ============================================================================
   GenAI Observatory — Light Warm-Mono Theme
   Design: "Readable like a morning brief, sharp like a dev tool."
   ============================================================================ */

:root {
  /* Background & Surface */
  --background: 0 0% 100%;          /* #FFFFFF */
  --foreground: 20 14% 10%;         /* #1C1917 (stone-900) */
  --card: 40 20% 98%;               /* #FAFAF9 (stone-50) */
  --card-foreground: 20 14% 10%;    /* #1C1917 */
  --popover: 0 0% 100%;
  --popover-foreground: 20 14% 10%;

  /* Primary = amber accent */
  --primary: 38 92% 50%;            /* #F59E0B (amber-500) */
  --primary-foreground: 0 0% 100%;  /* white on amber */

  /* Secondary = warm gray surface */
  --secondary: 40 20% 98%;          /* #FAFAF9 */
  --secondary-foreground: 20 14% 10%;

  /* Muted = warm gray */
  --muted: 40 20% 98%;              /* #FAFAF9 */
  --muted-foreground: 25 6% 45%;    /* #78716C (stone-500) */

  /* Accent = amber */
  --accent: 38 92% 50%;
  --accent-foreground: 0 0% 100%;

  /* Alert */
  --destructive: 0 84% 60%;         /* #EF4444 */
  --destructive-foreground: 0 0% 100%;

  /* Border = warm gray */
  --border: 30 7% 89%;              /* #E7E5E3 (stone-200) */
  --input: 30 7% 89%;
  --ring: 38 92% 50%;               /* amber focus ring */

  --radius: 0.5rem;

  /* Geist font families (set by next/font CSS variables) */
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SFMono-Regular", monospace;
}

* {
  border-color: hsl(var(--border));
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
}

/* Utility: Geist Mono for metadata */
@layer utilities {
  .font-mono {
    font-family: var(--font-mono);
  }
}
```

Key changes:
- Removed `.dark {}` theme block entirely
- Removed body background-image (grid pattern)
- Removed ALL `glass-*` utilities (glass, glass-card, glass-header, glass-glow, glass-glow-*)
- Replaced dark blue-gray palette with warm stone/white palette
- Primary/accent = amber (#F59E0B)
- Font stack references Geist via CSS variables
- Added `.font-mono` utility mapping to Geist Mono

### Step 2: Verify build compiles (glass classes will be missing — that's expected, we fix usages next)

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 3: Commit

```bash
git add apps/web/src/app/globals.css
git commit -m "style(web): replace dark glassmorphism theme with light warm-mono palette"
```

---

## Commit 3: `refactor(web): replace navigation — bottom tabs (mobile) + icon rail (desktop)`

### Files:
- Create: `apps/web/src/components/layout/bottom-tab-bar.tsx`
- Create: `apps/web/src/components/layout/icon-rail.tsx`
- Modify: `apps/web/src/components/layout/sidebar.tsx` (delete contents, re-export IconRail)
- Modify: `apps/web/src/components/layout/mobile-nav.tsx` (delete contents, re-export BottomTabBar)
- Modify: `apps/web/src/components/layout/index.ts`
- Modify: `apps/web/src/components/layout/observatory-shell.tsx`
- Modify: `apps/web/src/components/layout/header.tsx`

### Step 1: Create BottomTabBar

Create `apps/web/src/components/layout/bottom-tab-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Radio } from "lucide-react";
import { cn } from "@genai/ui";

const tabs = [
  { href: "/daily", label: "Dnevni", icon: Newspaper },
  { href: "/live", label: "Uzivo", icon: Radio },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border md:hidden z-50 pb-safe">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center py-3 text-xs min-h-[56px]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Step 2: Create IconRail

Create `apps/web/src/components/layout/icon-rail.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Radio, Search, Eye, LayoutGrid } from "lucide-react";
import { cn } from "@genai/ui";

const navItems = [
  { href: "/daily", label: "Dnevni", icon: Newspaper },
  { href: "/live", label: "Uzivo", icon: Radio },
  { href: "/explore", label: "Istrazi", icon: Search },
  { href: "/watchlists", label: "Pracenje", icon: Eye },
  { href: "/observatory", label: "Observatory", icon: LayoutGrid },
] as const;

export function IconRail() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-14 hover:w-[200px] transition-all duration-200 border-r border-border bg-background group/rail overflow-hidden shrink-0">
      <div className="p-3 border-b border-border">
        <Link href="/daily" className="font-semibold text-sm whitespace-nowrap">
          <span className="block group-hover/rail:hidden text-center">G</span>
          <span className="hidden group-hover/rail:block pl-1">GenAI</span>
        </Link>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap",
                isActive
                  ? "text-foreground border-l-2 border-primary bg-card"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Step 3: Rewrite sidebar.tsx as re-export

Replace `apps/web/src/components/layout/sidebar.tsx`:

```tsx
// Sidebar replaced by IconRail in mobile-first redesign
export { IconRail as Sidebar } from "./icon-rail";
```

### Step 4: Rewrite mobile-nav.tsx as re-export

Replace `apps/web/src/components/layout/mobile-nav.tsx`:

```tsx
// MobileNav replaced by BottomTabBar in mobile-first redesign
export { BottomTabBar as MobileNav } from "./bottom-tab-bar";
```

### Step 5: Update index.ts exports

Replace `apps/web/src/components/layout/index.ts`:

```tsx
export { ObservatoryShell } from "./observatory-shell";
export { IconRail } from "./icon-rail";
export { BottomTabBar } from "./bottom-tab-bar";
export { Header } from "./header";
export { ContextPanel } from "./context-panel";
```

### Step 6: Rewrite ObservatoryShell to use new nav

Replace `apps/web/src/components/layout/observatory-shell.tsx`:

```tsx
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
```

Key changes:
- `pb-20` on mobile for bottom tab bar clearance
- `min-w-0` on content to prevent icon rail overflow
- `bg-background` on root div

### Step 7: Restyle Header

Replace `apps/web/src/components/layout/header.tsx` — remove glassmorphism, apply warm-mono:

The header needs these changes:
- Replace `glass-header` with `bg-background border-b border-border`
- Replace green ping dot with amber text "GenAI" wordmark
- Desktop: show "GenAI Observatory" left, search center, timestamp right
- Mobile: show "GenAI" left, search icon right
- Replace dark theme colors with warm-mono palette

Full rewrite (keeping the same search logic + dropdown):

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { trpc } from "@/trpc";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const mobileOutside = mobileDropdownRef.current && !mobileDropdownRef.current.contains(target);
      const desktopOutside = desktopDropdownRef.current && !desktopDropdownRef.current.contains(target);
      if (mobileOutside && desktopOutside) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: searchData, isLoading: isSearching } =
    trpc.search.instant.useQuery(
      { query: debouncedQuery, limit: 10 },
      { enabled: debouncedQuery.length > 0 }
    );

  const results = searchData?.results ?? [];

  useEffect(() => {
    if (results.length > 0 && debouncedQuery.length > 0) {
      setIsDropdownOpen(true);
    }
  }, [results.length, debouncedQuery.length]);

  const handleInputFocus = () => {
    if (results.length > 0) setIsDropdownOpen(true);
  };

  const handleResultClick = (_id: string) => {
    setIsDropdownOpen(false);
    onSearchChange("");
  };

  const SearchDropdown = () => (
    <>
      {isDropdownOpen && debouncedQuery.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-sm z-50 max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Rezultati pretrage"
        >
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground">
              <span className="animate-pulse">Pretrazujem...</span>
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1" role="presentation">
              {results.map((result) => (
                <li key={result.id} role="option">
                  <button
                    onClick={() => handleResultClick(result.id)}
                    className="w-full px-4 py-3 text-left hover:bg-card transition-colors flex items-start gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset min-h-[44px]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          {result.type}
                        </span>
                        {result.impactLevel && (result.impactLevel === "BREAKING" || result.impactLevel === "HIGH") && (
                          <span className={`w-2 h-2 rounded-full ${result.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500"}`} />
                        )}
                      </div>
                      <p className="font-medium truncate">{result.title}</p>
                      {result.titleHr && (
                        <p className="text-sm text-muted-foreground truncate">{result.titleHr}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Nema rezultata za &quot;{debouncedQuery}&quot;
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <header className="bg-background border-b border-border sticky top-0 z-40">
      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 h-12">
          <span className="font-semibold text-lg">GenAI</span>
          <button
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded text-muted-foreground"
            aria-label={mobileSearchOpen ? "Zatvori pretragu" : "Otvori pretragu"}
            aria-expanded={mobileSearchOpen}
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {mobileSearchOpen && (
          <div className="px-4 pb-3">
            <div className="relative" ref={mobileDropdownRef}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={handleInputFocus}
                placeholder="Pretrazi dogadaje, entitete..."
                className="w-full rounded-md border border-border px-3 py-2 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <SearchDropdown />
            </div>
          </div>
        )}
      </div>

      {/* Desktop header */}
      <div className="hidden md:block">
        <div className="flex items-center gap-4 px-6 h-14">
          <h1 className="text-lg font-semibold whitespace-nowrap">GenAI Observatory</h1>
          <div className="relative flex-1 max-w-md" ref={desktopDropdownRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="Pretrazi dogadaje, entitete..."
              className="w-full rounded-md border border-border pl-9 pr-3 py-1.5 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <SearchDropdown />
          </div>
          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap ml-auto">
            {new Date().toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </header>
  );
}
```

### Step 8: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 9: Commit

```bash
git add apps/web/src/components/layout/
git commit -m "refactor(web): replace navigation — bottom tabs (mobile) + icon rail (desktop)"
```

---

## Commit 4: `feat(web): rebuild Daily page as ranked accordion with roundtable teaser`

### Files:
- Create: `apps/web/src/components/daily/ranked-event-list.tsx`
- Create: `apps/web/src/components/daily/roundtable-teaser.tsx`
- Modify: `apps/web/src/app/daily/page.tsx`
- Modify: `apps/web/src/app/daily/layout.tsx` (create — daily needs ObservatoryShell)
- Modify: `apps/web/src/app/page.tsx` (redirect to /daily instead of /observatory)

### Step 1: Create daily layout

Create `apps/web/src/app/daily/layout.tsx`:

```tsx
import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function DailyLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </SelectionProvider>
  );
}
```

### Step 2: Create RoundtableTeaser

Create `apps/web/src/components/daily/roundtable-teaser.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RoundtableSection } from "./roundtable-section";

interface RoundtableTurn {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType: string;
  text: string;
  textHr: string;
  eventRef?: number;
}

interface RoundtableTeaserProps {
  turns: RoundtableTurn[];
  previewCount?: number;
}

export function RoundtableTeaser({ turns, previewCount = 2 }: RoundtableTeaserProps) {
  const [expanded, setExpanded] = useState(false);

  if (turns.length === 0) return null;

  const previewTurns = turns.slice(0, previewCount);

  return (
    <div className="border-l-2 border-primary pl-4 py-3">
      {expanded ? (
        <>
          <RoundtableSection turns={turns} />
          <button
            onClick={() => setExpanded(false)}
            className="mt-3 text-sm text-primary font-medium hover:underline"
          >
            Sakrij raspravu
          </button>
        </>
      ) : (
        <>
          {previewTurns.map((turn, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{turn.persona}:</span>{" "}
              {turn.textHr.length > 120
                ? turn.textHr.slice(0, 120) + "..."
                : turn.textHr}
            </p>
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 text-sm text-primary font-medium hover:underline"
          >
            Prikazi raspravu ({turns.length})
          </button>
        </>
      )}
    </div>
  );
}
```

### Step 3: Create RankedEventList

Create `apps/web/src/components/daily/ranked-event-list.tsx`:

This is the core new component — accordion list, one-open-at-a-time.

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { pickLatestArtifact } from "@genai/shared";
import { cn } from "@genai/ui";

// Source type short labels for [SOURCE] tags
const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

interface ArtifactPayload { en?: string; hr?: string; }
interface WhatHappenedPayload { en?: string; hr?: string; sourceLine?: string; }
interface WhyMattersPayload { text?: string; textHr?: string; }

interface RankedEvent {
  rank: number;
  event: {
    id: string;
    title: string;
    titleHr?: string | null;
    occurredAt: Date;
    impactLevel: string;
    sourceType: string;
    sourceCount?: number;
    confidence?: string | null;
    artifacts: Array<{ artifactType: string; payload: unknown; version?: number }>;
    mentions?: Array<{ entity: { id: string; name: string; slug: string; type: string } }>;
  } | null;
}

interface RankedEventListProps {
  events: RankedEvent[];
}

export function RankedEventList({ events }: RankedEventListProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border">
      {events.map(({ rank, event }) => {
        if (!event) return null;
        const isOpen = openIndex === rank;
        return (
          <RankedEventRow
            key={event.id}
            rank={rank}
            event={event}
            isOpen={isOpen}
            onToggle={() => setOpenIndex(isOpen ? null : rank)}
          />
        );
      })}
    </div>
  );
}

function RankedEventRow({
  rank,
  event,
  isOpen,
  onToggle,
}: {
  rank: number;
  event: NonNullable<RankedEvent["event"]>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const displayTitle = event.titleHr || event.title;
  const sourceLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
  const timeStr = new Date(event.occurredAt).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const showDot = event.impactLevel === "BREAKING" || event.impactLevel === "HIGH";
  const dotColor = event.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500";

  // Extract artifacts for expanded view
  const mapped = event.artifacts.map((a) => ({
    type: a.artifactType,
    payload: a.payload,
    version: a.version ?? 1,
  }));
  const whatHappened = pickLatestArtifact<WhatHappenedPayload>(mapped, "WHAT_HAPPENED");
  const whyMatters = pickLatestArtifact<WhyMattersPayload>(mapped, "WHY_MATTERS");

  return (
    <div className="py-3">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 group min-h-[44px]"
        aria-expanded={isOpen}
      >
        <span className="font-mono text-lg text-muted-foreground w-6 text-right shrink-0 pt-0.5">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {showDot && <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />}
            <span className="font-semibold text-sm leading-snug line-clamp-1">
              {displayTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-muted-foreground">
            <span>[{sourceLabel}]</span>
            <span aria-hidden="true">&middot;</span>
            <span>{event.confidence || "MED"}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{event.sourceCount ?? 1} izvora</span>
            <span aria-hidden="true">&middot;</span>
            <span>{timeStr}</span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="ml-9 mt-3 space-y-4 pb-2">
          {whatHappened && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Sto se dogodilo
              </h4>
              <p className="text-sm leading-relaxed">
                {whatHappened.payload.hr || whatHappened.payload.en || ""}
              </p>
            </div>
          )}

          {whyMatters && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Zasto je vazno
              </h4>
              <p className="text-sm leading-relaxed">
                {whyMatters.payload.textHr || whyMatters.payload.text || ""}
              </p>
            </div>
          )}

          {event.mentions && event.mentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {event.mentions.slice(0, 5).map((m) => (
                <Link
                  key={m.entity.id}
                  href={`/explore/${m.entity.slug}`}
                  className="text-xs font-mono px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  {m.entity.name}
                </Link>
              ))}
            </div>
          )}

          <Link
            href={`/observatory?event=${event.id}`}
            className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline"
          >
            Otvori dosje
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
```

### Step 4: Rewrite Daily page

Replace `apps/web/src/app/daily/page.tsx`:

```tsx
"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/trpc";
import { DailyStreakBadge } from "@/components/daily/streak-badge";
import { RoundtableTeaser } from "@/components/daily/roundtable-teaser";
import { RankedEventList } from "@/components/daily/ranked-event-list";

interface RoundtableTurn {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType: string;
  text: string;
  textHr: string;
  eventRef?: number;
}

interface BriefingPayload {
  roundtable?: RoundtableTurn[];
  changedSince?: { en: string; hr: string; highlights: string[] };
  prediction?: { en: string; hr: string; confidence: string; caveats?: string[] };
  eventCount: number;
  sourceCount: number;
  topEntities: string[];
}

export default function DailyRunPage() {
  const { data: briefing, isLoading: briefingLoading } =
    trpc.dailyBriefings.today.useQuery();

  const { data: catchUp } = trpc.sessions.getCatchUp.useQuery();

  const { data: briefingWithEvents, isLoading: eventsLoading } =
    trpc.dailyBriefings.byIdWithEvents.useQuery(briefing?.id ?? "", {
      enabled: !!briefing?.id,
    });

  const payload = briefing?.payload as BriefingPayload | undefined;

  // Loading skeleton
  if (briefingLoading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-card rounded w-2/3" />
          <div className="h-4 bg-card rounded w-1/3" />
          <div className="h-px bg-border my-6" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3 py-3">
              <div className="w-6 h-6 bg-card rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-card rounded w-3/4" />
                <div className="h-3 bg-card rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const todayFormatted = new Date().toLocaleDateString("hr-HR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-[720px] mx-auto px-4 py-8">
      {/* Date header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold capitalize">{todayFormatted}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-sm text-muted-foreground">
            {payload?.eventCount ?? 0} dogadaja &middot; {payload?.sourceCount ?? 0} izvora
          </span>
          <DailyStreakBadge />
        </div>
      </header>

      {!briefing ? (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg">Dananji briefing jos nije generiran</p>
          <p className="text-sm text-muted-foreground mt-1">
            Briefing se generira svaki dan u 06:00 CET
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Roundtable teaser */}
          {payload?.roundtable && payload.roundtable.length > 0 && (
            <RoundtableTeaser turns={payload.roundtable} />
          )}

          {/* Ranked event list */}
          {eventsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 py-3 border-b border-border">
                  <div className="w-6 h-6 bg-card rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-card rounded w-3/4" />
                    <div className="h-3 bg-card rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : briefingWithEvents?.events?.length ? (
            <RankedEventList events={briefingWithEvents.events} />
          ) : (
            <p className="text-muted-foreground text-sm py-4">
              Nema kljucnih dogadaja za danas
            </p>
          )}

          {/* Catch-up section */}
          {catchUp && catchUp.count > 0 && (
            <div className="border-t border-border pt-6">
              <p className="text-sm">
                Propustili ste{" "}
                <span className="font-mono font-semibold">{catchUp.count}</span>{" "}
                dogadaja
              </p>
              <Link
                href="/live"
                className="inline-block mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                Nadoknadite
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 5: Update root redirect

Replace `apps/web/src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/daily");
}
```

### Step 6: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 7: Commit

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/daily/ apps/web/src/components/daily/
git commit -m "feat(web): rebuild Daily page as ranked accordion with roundtable teaser"
```

---

## Commit 5: `feat(web): add Live feed route`

### Files:
- Create: `apps/web/src/app/live/page.tsx`
- Create: `apps/web/src/app/live/layout.tsx`

### Step 1: Create live layout

Create `apps/web/src/app/live/layout.tsx`:

```tsx
import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </SelectionProvider>
  );
}
```

### Step 2: Create Live page

Create `apps/web/src/app/live/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { trpc } from "@/trpc";

const SOURCE_LABELS: Record<string, string> = {
  HN: "HN", GITHUB: "GH", ARXIV: "arXiv", NEWSAPI: "News",
  REDDIT: "Reddit", LOBSTERS: "Lob", PRODUCTHUNT: "PH",
  DEVTO: "Dev", YOUTUBE: "YT", LEADERBOARD: "LB", HUGGINGFACE: "HF",
};

export default function LivePage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.events.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined }
    );

  const events = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="max-w-[720px] mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-1">Uzivo</h1>
      <p className="text-sm font-mono text-muted-foreground mb-6">
        Svi dogadaji, kronoloski
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse py-3 border-b border-border">
              <div className="h-4 bg-card rounded w-3/4 mb-2" />
              <div className="h-3 bg-card rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nema objavljenih dogadaja
        </p>
      ) : (
        <div className="divide-y divide-border">
          {events.map((event) => {
            const displayTitle = event.titleHr || event.title;
            const sourceLabel = SOURCE_LABELS[event.sourceType] || event.sourceType;
            const showDot = event.impactLevel === "BREAKING" || event.impactLevel === "HIGH";
            const dotColor = event.impactLevel === "BREAKING" ? "bg-red-500" : "bg-amber-500";
            const timeStr = new Date(event.occurredAt).toLocaleTimeString("hr-HR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Link
                key={event.id}
                href={`/observatory?event=${event.id}`}
                className="block py-3 hover:bg-card transition-colors -mx-2 px-2 rounded"
              >
                <div className="flex items-center gap-1.5">
                  {showDot && <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />}
                  <span className="font-semibold text-sm leading-snug line-clamp-1">
                    {displayTitle}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-muted-foreground">
                  <span>[{sourceLabel}]</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{event.confidence || "MED"}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{event.sourceCount ?? 1} izvora</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{timeStr}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="py-6 text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {isFetchingNextPage ? "Ucitavam..." : "Ucitaj vise"}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Note:** `useInfiniteQuery` requires the `list` procedure to work with cursor pagination — it already does (returns `nextCursor`). If `useInfiniteQuery` isn't available on the tRPC proxy, fall back to regular `useQuery` with manual cursor tracking. Check the tRPC client setup.

### Step 3: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 4: Commit

```bash
git add apps/web/src/app/live/
git commit -m "feat(web): add Live feed route"
```

---

## Commit 6: `style(web): restyle Observatory page — remove glows, apply warm-mono`

### Files:
- Modify: `apps/web/src/app/observatory/page.tsx`
- Modify: `apps/web/src/components/cockpit/status-bar.tsx`
- Modify: `apps/web/src/components/cockpit/briefing-card.tsx`
- Modify: `apps/web/src/components/cockpit/stats-grid.tsx`
- Modify: `apps/web/src/components/cockpit/source-section.tsx`
- Modify: `apps/web/src/components/cockpit/cockpit-event-card.tsx`

### Step 1: Observatory page — remove glowClass usage

In `apps/web/src/app/observatory/page.tsx`, change each `SOURCE_GROUPS` entry to remove `glowClass` (it's no longer defined in CSS).

Replace all `glowClass: "glass-glow-*"` with empty string or just remove the property entirely. Then update the `SourceSection` component call to not pass `glowClass`.

### Step 2: Restyle StatusBar

Replace the classes in `apps/web/src/components/cockpit/status-bar.tsx`:
- `glass-header` → `bg-card border border-border`
- `text-green-400` → `text-muted-foreground`
- Remove the green ping dot, replace with simple text "Uzivo"

### Step 3: Restyle BriefingCard

In `apps/web/src/components/cockpit/briefing-card.tsx`:
- `glass-card glass-glow` → `bg-card border border-border`
- `text-blue-400` → `text-primary`

### Step 4: Restyle StatsGrid

In `apps/web/src/components/cockpit/stats-grid.tsx`:
- `glass-card` → `bg-card border border-border`
- All color classes (`text-red-400`, `text-orange-400`, etc.) → `text-foreground`

### Step 5: Restyle SourceSection

In `apps/web/src/components/cockpit/source-section.tsx`:
- `glass-card ... ${glowClass}` → `bg-card border border-border`
- `border-white/5` → `border-border`
- `bg-white/10` → `bg-card`
- Remove `glowClass` prop entirely

### Step 6: Restyle CockpitEventCard

In `apps/web/src/components/cockpit/cockpit-event-card.tsx`:
- Keep impact dot colors (red/amber) for BREAKING/HIGH
- Change MEDIUM dot to `bg-transparent` (no dot per design)
- Change LOW dot to `bg-transparent` (no dot per design)
- `border-primary/50 bg-primary/5` → keep (amber selection)
- `hover:border-white/5` → `hover:bg-card`
- `bg-white/5` topic chips → `bg-card border border-border`
- Confidence colors: remove colored text, use plain `text-muted-foreground` with Geist Mono

### Step 7: Restyle ContextPanel

In `apps/web/src/components/layout/context-panel.tsx`:
- `bg-card` stays (it maps to `#FAFAF9` now)
- `bg-white/5` → `bg-card`
- `border-white/10` → `border-border`
- `text-cyan-400`, `text-green-400`, `text-amber-400` persona borders → `text-muted-foreground` (or keep amber for GM)
- `bg-amber-500/10 border-amber-500/20` → `bg-amber-50 border-amber-200`
- `bg-emerald-500/20 text-emerald-400` → `text-muted-foreground font-mono`
- Remove all `/20` opacity colors — use solid warm grays

### Step 8: Restyle RoundtableSection

In `apps/web/src/components/daily/roundtable-section.tsx`:
- `text-cyan-400` → `text-foreground` (GM)
- `text-green-400` → `text-muted-foreground` (Engineer)
- `text-amber-400` → `text-muted-foreground` (Skeptic)
- `border-l-cyan-500/50` → `border-l-primary` (GM gets amber)
- `border-l-green-500/50` → `border-l-border`
- `border-l-amber-500/50` → `border-l-border`
- `bg-muted` → stays

### Step 9: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 10: Commit

```bash
git add apps/web/src/app/observatory/ apps/web/src/components/cockpit/ apps/web/src/components/layout/context-panel.tsx apps/web/src/components/daily/roundtable-section.tsx
git commit -m "style(web): restyle Observatory page — remove glows, apply warm-mono"
```

---

## Commit 7: `style(web): restyle Explore and entity pages to warm-mono`

### Files:
- Modify: `apps/web/src/app/explore/page.tsx`
- Modify: `apps/web/src/app/explore/[slug]/page.tsx`
- Modify: `apps/web/src/components/entity/entity-graph.tsx`
- Modify: `apps/web/src/components/entity/related-entities.tsx`
- Modify: `apps/web/src/components/entity/events-timeline.tsx`
- Modify: `apps/web/src/components/entity/type-config.ts`
- Modify: `apps/web/src/app/explore/layout.tsx` (create if missing — needs ObservatoryShell)

### Step 1: Create explore layout if missing

Check if `apps/web/src/app/explore/layout.tsx` exists. If not, create:

```tsx
import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </SelectionProvider>
  );
}
```

### Step 2: Restyle explore page

In `apps/web/src/app/explore/page.tsx`:
- Wrap in `max-w-[720px] mx-auto` for centered column
- Replace dark-themed colors with warm-mono
- Type filter pills: use `border border-border` when inactive, `bg-primary text-white` when active
- Search input: `bg-card border border-border`
- Results: `hover:bg-card` instead of dark hover

### Step 3: Restyle entity pages

In `apps/web/src/app/explore/[slug]/page.tsx`:
- Wrap in `max-w-[720px] mx-auto`
- Replace dark colors with warm-mono
- Entity header: warm grays, Geist Mono for type badge

### Step 4: Update type-config.ts

In `apps/web/src/components/entity/type-config.ts`:
- Replace dark-theme colors (`bg-blue-500/20 text-blue-300`) with light equivalents (`bg-blue-50 text-blue-700`)

### Step 5: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 6: Commit

```bash
git add apps/web/src/app/explore/ apps/web/src/components/entity/
git commit -m "style(web): restyle Explore and entity pages to warm-mono"
```

---

## Commit 8: `style(web): restyle remaining pages (library, watchlists) + DailyStreakBadge`

### Files:
- Modify: `apps/web/src/app/library/page.tsx`
- Modify: `apps/web/src/app/watchlists/page.tsx`
- Modify: `apps/web/src/components/daily/streak-badge.tsx`
- Create: `apps/web/src/app/library/layout.tsx`
- Create: `apps/web/src/app/watchlists/layout.tsx`

### Step 1: Add layouts for library and watchlists

Each gets a simple layout with ObservatoryShell:

```tsx
import { SelectionProvider } from "@/context/selection-context";
import { ObservatoryShell } from "@/components/layout";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectionProvider>
      <ObservatoryShell>{children}</ObservatoryShell>
    </SelectionProvider>
  );
}
```

Same pattern for watchlists.

### Step 2: Restyle DailyStreakBadge

In `apps/web/src/components/daily/streak-badge.tsx`:
- `bg-primary/20 text-primary` → `bg-amber-50 text-amber-700 font-mono text-xs`

### Step 3: Verify

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck --filter=@genai/web
```

### Step 4: Commit

```bash
git add apps/web/src/app/library/ apps/web/src/app/watchlists/ apps/web/src/components/daily/streak-badge.tsx
git commit -m "style(web): restyle remaining pages (library, watchlists) + DailyStreakBadge"
```

---

## Commit 9: `test(web): verify build, check 375px layout, clean up dead code`

### Files:
- Delete: `apps/web/src/context/mobile-lane-context.tsx` (if exists — dead code from old MobileNav)
- Verify: full build

### Step 1: Clean up dead code

Check if `mobile-lane-context.tsx` exists and is unused. If so, delete it.

### Step 2: Verify full build

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm build --filter=@genai/web
```

### Step 3: Verify typecheck across monorepo

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm typecheck
```

### Step 4: Run tests

```bash
cd /home/wandeon/GenAI2/.worktrees/mobile-redesign && pnpm test
```

### Step 5: Check for TODO/FIXME

```bash
grep -r "TODO\|FIXME" apps/web/src/components/layout/ apps/web/src/components/daily/ apps/web/src/app/daily/ apps/web/src/app/live/ apps/web/src/app/page.tsx
```

### Step 6: Commit cleanup

```bash
git add -A
git commit -m "test(web): verify build, clean up dead code"
```

---

## Gate Verification

After all commits, check:
1. `pnpm build --filter=@genai/web` succeeds
2. `pnpm typecheck` passes
3. `pnpm test` passes
4. No `glass-*` classes remain in codebase (should get Tailwind warnings)
5. `/daily` is the default landing page
6. Bottom tabs appear on mobile (< 768px)
7. Icon rail appears on desktop (>= 768px)
8. Ranked event list shows numbered events with accordion expand
9. Live feed shows chronological events with infinite scroll

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/src/app/layout.tsx` | Root layout with Geist fonts |
| `apps/web/src/app/globals.css` | Theme: warm-mono palette |
| `apps/web/src/app/page.tsx` | Redirect to /daily |
| `apps/web/src/app/daily/page.tsx` | Daily Run — ranked accordion |
| `apps/web/src/app/live/page.tsx` | Live feed — chronological |
| `apps/web/src/components/layout/bottom-tab-bar.tsx` | Mobile nav (2 tabs) |
| `apps/web/src/components/layout/icon-rail.tsx` | Desktop nav (56px rail) |
| `apps/web/src/components/layout/observatory-shell.tsx` | Main layout shell |
| `apps/web/src/components/layout/header.tsx` | Sticky header, search |
| `apps/web/src/components/daily/ranked-event-list.tsx` | Core accordion list |
| `apps/web/src/components/daily/roundtable-teaser.tsx` | Council preview |
| `docs/plans/2026-02-06-mobile-first-redesign.md` | Design spec |
