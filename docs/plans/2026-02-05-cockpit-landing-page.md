# Cockpit Landing Page - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-page Observatory with a single-page glassmorphic cockpit hub showing live AI news, removing the useless 7-day time machine.

**Architecture:** Single page at `/` with framer-motion animations, glassmorphism cards, and a cockpit-style layout. All content streams (HN, GitHub, arXiv), daily briefing summary, entity spotlight, and search are visible at a glance. No page navigation needed for core experience. Remove TimeContext, time-machine component, and all catch-up machinery.

**Tech Stack:** Next.js 16, framer-motion (new dep), Tailwind CSS v4 with backdrop-blur glassmorphism, tRPC, React 19

---

## What Gets Removed

- `apps/web/src/components/time-machine.tsx` - Delete entirely
- `apps/web/src/context/time-context.tsx` - Delete entirely
- `apps/web/src/app/observatory/layout.tsx` - Rewrite (remove TimeProvider)
- Time-related props/state from observatory page
- `beforeTime` param from events.list queries (always fetch latest)
- `catchUp` URL param handling
- `countSince` query usage
- `apps/web/src/app/page.tsx` - Replace nav hub with redirect to /observatory

## What Gets Kept

- `EventCard` component (restyled for glass)
- `Lane` component (restyled for glass)
- `SelectionContext` and `MobileLaneContext`
- tRPC routers (events, entities, dailyBriefings, search)
- `ContextPanel` (event detail sidebar)
- Mobile bottom nav
- Keyboard navigation

---

### Task 1: Install framer-motion

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install framer-motion**

Run: `cd /home/wandeon/GenAI2 && pnpm add framer-motion --filter @genai/web`

**Step 2: Verify installation**

Run: `pnpm list framer-motion --filter @genai/web`
Expected: `framer-motion` listed

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add framer-motion for cockpit animations"
```

---

### Task 2: Remove Time Machine and TimeContext

**Files:**
- Delete: `apps/web/src/components/time-machine.tsx`
- Delete: `apps/web/src/context/time-context.tsx`
- Modify: `apps/web/src/app/observatory/layout.tsx` - Remove TimeProvider
- Modify: `apps/web/src/components/layout/header.tsx` - Remove TimeMachine from header

**Step 1: Update observatory layout to remove TimeProvider**

File: `apps/web/src/app/observatory/layout.tsx`

Replace entire file with:
```tsx
"use client";

import { SelectionProvider } from "@/context/selection-context";
import { MobileLaneProvider } from "@/context/mobile-lane-context";
import { ObservatoryShell } from "@/components/layout/observatory-shell";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SelectionProvider>
      <MobileLaneProvider>
        <ObservatoryShell>{children}</ObservatoryShell>
      </MobileLaneProvider>
    </SelectionProvider>
  );
}
```

**Step 2: Update header to remove TimeMachine**

File: `apps/web/src/components/layout/header.tsx`

Remove the TimeMachine import and its rendering. Remove all time-related imports (`useTime`). Keep the search bar and title. The header should just be:
- Desktop: Title "Observatory" + Search bar
- Mobile: Logo + Search button

**Step 3: Delete time-machine.tsx and time-context.tsx**

```bash
rm apps/web/src/components/time-machine.tsx
rm apps/web/src/context/time-context.tsx
```

**Step 4: Update observatory page to remove time references**

File: `apps/web/src/app/observatory/page.tsx`

Remove:
- `useTime()` hook call and all its destructured values
- `beforeTime` from events.list query (pass no time filter)
- `countSince` query entirely
- `useEffect` for catch-up count
- `useEffect` for catchUp URL param
- `catchUpInitialized` ref
- `useSearchParams()` and the Suspense wrapper (no longer needed)
- `useRef` import if unused

The page becomes simpler:
```tsx
"use client";

import { useMemo } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import { trpc } from "@/trpc";
import { useSelection } from "@/context/selection-context";
import { useMobileLane, type LaneId } from "@/context/mobile-lane-context";
import { useSwipe } from "@/hooks";

const lanes: LaneId[] = ["hn", "github", "arxiv"];

export default function ObservatoryPage() {
  const { selectedEvent, selectEvent } = useSelection();
  const { activeLane, setActiveLane } = useMobileLane();

  const currentIndex = lanes.indexOf(activeLane);
  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: () => {
      if (currentIndex < lanes.length - 1) setActiveLane(lanes[currentIndex + 1]);
    },
    onSwipeRight: () => {
      if (currentIndex > 0) setActiveLane(lanes[currentIndex - 1]);
    },
  });

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const events = eventsData?.items ?? [];

  const hnEvents = useMemo(() => events.filter((e) => e.sourceType === "HN"), [events]);
  const ghEvents = useMemo(() => events.filter((e) => e.sourceType === "GITHUB"), [events]);
  const arxivEvents = useMemo(() => events.filter((e) => e.sourceType === "ARXIV"), [events]);

  const renderEventCard = (event: (typeof events)[0]) => (
    <EventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEvent?.id === event.id}
      onClick={() => selectEvent(event)}
    />
  );

  return (
    <div className="h-full">
      {/* Desktop: 3 columns */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 h-full">
        <Lane title="Hacker News" icon={<span className="text-orange-500">🔶</span>} count={hnEvents.length} isLoading={isLoading}>
          {hnEvents.length > 0 ? hnEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema HN vijesti</p>}
        </Lane>
        <Lane title="GitHub" icon={<span>🐙</span>} count={ghEvents.length} isLoading={isLoading}>
          {ghEvents.length > 0 ? ghEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema GitHub projekata</p>}
        </Lane>
        <Lane title="Radovi" icon={<span>📄</span>} count={arxivEvents.length} isLoading={isLoading}>
          {arxivEvents.length > 0 ? arxivEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema radova</p>}
        </Lane>
      </div>

      {/* Mobile: Single lane */}
      <div className="md:hidden h-full pb-20" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {activeLane === "hn" && (
          <Lane title="Hacker News" icon={<span className="text-orange-500">🔶</span>} count={hnEvents.length} isLoading={isLoading}>
            {hnEvents.length > 0 ? hnEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema HN vijesti</p>}
          </Lane>
        )}
        {activeLane === "github" && (
          <Lane title="GitHub" icon={<span>🐙</span>} count={ghEvents.length} isLoading={isLoading}>
            {ghEvents.length > 0 ? ghEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema GitHub projekata</p>}
          </Lane>
        )}
        {activeLane === "arxiv" && (
          <Lane title="Radovi" icon={<span>📄</span>} count={arxivEvents.length} isLoading={isLoading}>
            {arxivEvents.length > 0 ? arxivEvents.map(renderEventCard) : <p className="text-muted-foreground text-sm p-2">Nema radova</p>}
          </Lane>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Verify build**

Run: `cd /home/wandeon/GenAI2 && pnpm typecheck --filter @genai/web`
Expected: No errors

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(web): remove Time Machine and TimeContext

The 7-day scrubber didn't solve a real user problem. Users want fresh
news, not to browse old events. Simplified Observatory to always show
latest events."
```

---

### Task 3: Create glassmorphic design tokens and base styles

**Files:**
- Modify: `apps/web/src/app/globals.css` - Add glass utility classes

**Step 1: Add glassmorphism utilities to globals.css**

Append to `apps/web/src/app/globals.css`:

```css
/* Glassmorphism utilities */
@layer utilities {
  .glass {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .glass-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  }

  .glass-header {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .glass-glow {
    box-shadow:
      0 0 20px rgba(59, 130, 246, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .glass-glow-green {
    box-shadow:
      0 0 20px rgba(34, 197, 94, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .glass-glow-orange {
    box-shadow:
      0 0 20px rgba(249, 115, 22, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .glass-glow-purple {
    box-shadow:
      0 0 20px rgba(168, 85, 247, 0.15),
      0 8px 32px rgba(0, 0, 0, 0.2);
  }
}
```

**Step 2: Update dark theme colors for cockpit feel**

In the `:root` CSS variables in globals.css, update the dark theme to have a deeper, more cockpit-like feel:

```css
.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 98%;
  --card: 222 47% 8%;
  --card-foreground: 210 40% 98%;
  --popover: 222 47% 8%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 14%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 14%;
  --muted-foreground: 215 20.2% 55%;
  --accent: 217.2 32.6% 14%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 50%;
  --destructive-foreground: 210 40% 98%;
  --border: 217.2 32.6% 14%;
  --input: 217.2 32.6% 14%;
  --ring: 224.3 76.3% 48%;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style(web): add glassmorphism utilities and dark cockpit theme"
```

---

### Task 4: Create the cockpit landing page

**Files:**
- Rewrite: `apps/web/src/app/page.tsx` - Full cockpit hub
- Create: `apps/web/src/components/cockpit/status-bar.tsx`
- Create: `apps/web/src/components/cockpit/news-lane.tsx`
- Create: `apps/web/src/components/cockpit/briefing-card.tsx`
- Create: `apps/web/src/components/cockpit/stats-grid.tsx`

This is the main task. The page should look like a mission control cockpit:

```
┌─────────────────────────────────────────────────────────┐
│  STATUS BAR: Live indicator + event count + last update │
├─────────────────────┬───────────────────────────────────┤
│                     │                                   │
│   BRIEFING CARD     │          STATS GRID               │
│   (GM summary)      │    (4 metric cards in 2x2)        │
│                     │                                   │
├─────────┬───────────┴───────────┬───────────────────────┤
│         │                       │                       │
│   HN    │       GitHub          │       arXiv           │
│  LANE   │        LANE           │        LANE           │
│         │                       │                       │
│         │                       │                       │
└─────────┴───────────────────────┴───────────────────────┘
```

**Step 1: Create status bar component**

File: `apps/web/src/components/cockpit/status-bar.tsx`

```tsx
"use client";

import { motion } from "framer-motion";

interface StatusBarProps {
  eventCount: number;
  lastUpdate: Date | null;
  isLoading: boolean;
}

export function StatusBar({ eventCount, lastUpdate, isLoading }: StatusBarProps) {
  const timeAgo = lastUpdate
    ? getTimeAgo(lastUpdate)
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-header flex items-center justify-between px-6 py-3 rounded-xl"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-sm font-mono text-green-400 uppercase tracking-wider">
          Uživo
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">{isLoading ? "—" : eventCount}</span>
          <span>događaja</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Zadnje ažuriranje:</span>
          <span className="font-mono text-foreground">{timeAgo}</span>
        </div>
      </div>
    </motion.div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "upravo sada";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours}h`;
  return `prije ${Math.floor(hours / 24)}d`;
}
```

**Step 2: Create news lane component (glassmorphic)**

File: `apps/web/src/components/cockpit/news-lane.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface NewsLaneProps {
  title: string;
  icon: ReactNode;
  count: number;
  accentColor: string;
  glowClass: string;
  children: ReactNode;
  isLoading?: boolean;
  delay?: number;
}

export function NewsLane({
  title,
  icon,
  count,
  accentColor,
  glowClass,
  children,
  isLoading,
  delay = 0,
}: NewsLaneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={`glass-card rounded-2xl flex flex-col h-full overflow-hidden ${glowClass}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h2 className="font-semibold text-sm tracking-wide">{title}</h2>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${accentColor}`}>
          {count}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground text-sm">Učitavanje...</div>
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}
```

**Step 3: Create briefing card component**

File: `apps/web/src/components/cockpit/briefing-card.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { trpc } from "@/trpc";

export function BriefingCard() {
  const { data: briefing } = trpc.dailyBriefings.today.useQuery();

  const payload = briefing?.payload as any;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="glass-card glass-glow rounded-2xl p-5 h-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📡</span>
        <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
          Dnevni pregled
        </h2>
      </div>

      {payload ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90">
            {payload.changedSince?.hr || payload.changedSince?.en || "Nema sažetka."}
          </p>
          {payload.changedSince?.highlights && (
            <ul className="space-y-1">
              {payload.changedSince.highlights.slice(0, 3).map((h: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">▸</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Dnevni pregled još nije generiran.
        </p>
      )}
    </motion.div>
  );
}
```

**Step 4: Create stats grid component**

File: `apps/web/src/components/cockpit/stats-grid.tsx`

```tsx
"use client";

import { motion } from "framer-motion";

interface StatsGridProps {
  hnCount: number;
  ghCount: number;
  arxivCount: number;
  totalCount: number;
}

const stats = [
  { label: "Ukupno", key: "totalCount" as const, color: "text-blue-400", icon: "📊" },
  { label: "Hacker News", key: "hnCount" as const, color: "text-orange-400", icon: "🔶" },
  { label: "GitHub", key: "ghCount" as const, color: "text-purple-400", icon: "🐙" },
  { label: "arXiv", key: "arxivCount" as const, color: "text-green-400", icon: "📄" },
];

export function StatsGrid(props: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 h-full">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
          className="glass-card rounded-xl p-4 flex flex-col items-center justify-center"
        >
          <span className="text-2xl mb-1">{stat.icon}</span>
          <span className={`text-2xl font-bold font-mono ${stat.color}`}>
            {props[stat.key]}
          </span>
          <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
```

**Step 5: Create the cockpit event card (glassmorphic version)**

File: `apps/web/src/components/cockpit/cockpit-event-card.tsx`

```tsx
"use client";

import { motion } from "framer-motion";

interface CockpitEventCardProps {
  id: string;
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: "BREAKING" | "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  topics?: string[];
  isSelected?: boolean;
  onClick?: () => void;
}

const impactDot: Record<string, string> = {
  BREAKING: "bg-red-500 shadow-red-500/50 shadow-lg",
  HIGH: "bg-orange-500 shadow-orange-500/50 shadow-lg",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-500",
};

export function CockpitEventCard({
  title,
  titleHr,
  occurredAt,
  impactLevel,
  sourceCount,
  topics,
  isSelected,
  onClick,
}: CockpitEventCardProps) {
  const displayTitle = titleHr || title;
  const timeStr = new Date(occurredAt).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-transparent hover:border-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1.5 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${impactDot[impactLevel]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {displayTitle}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{timeStr}</span>
            {sourceCount > 1 && (
              <>
                <span>·</span>
                <span>{sourceCount} izvora</span>
              </>
            )}
          </div>
          {topics && topics.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {topics.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}
```

**Step 6: Rewrite the root page as cockpit hub**

File: `apps/web/src/app/page.tsx`

```tsx
import { redirect } from "next/navigation";

// Root redirects to the Observatory cockpit
export default function RootPage() {
  redirect("/observatory");
}
```

**Step 7: Rewrite the observatory page as cockpit**

File: `apps/web/src/app/observatory/page.tsx`

```tsx
"use client";

import { useMemo } from "react";
import { trpc } from "@/trpc";
import { useSelection } from "@/context/selection-context";
import { useMobileLane, type LaneId } from "@/context/mobile-lane-context";
import { useSwipe } from "@/hooks";
import { StatusBar } from "@/components/cockpit/status-bar";
import { NewsLane } from "@/components/cockpit/news-lane";
import { BriefingCard } from "@/components/cockpit/briefing-card";
import { StatsGrid } from "@/components/cockpit/stats-grid";
import { CockpitEventCard } from "@/components/cockpit/cockpit-event-card";

const lanes: LaneId[] = ["hn", "github", "arxiv"];

export default function ObservatoryPage() {
  const { selectedEvent, selectEvent } = useSelection();
  const { activeLane, setActiveLane } = useMobileLane();

  const currentIndex = lanes.indexOf(activeLane);
  const { handleTouchStart, handleTouchEnd } = useSwipe({
    onSwipeLeft: () => {
      if (currentIndex < lanes.length - 1) setActiveLane(lanes[currentIndex + 1]);
    },
    onSwipeRight: () => {
      if (currentIndex > 0) setActiveLane(lanes[currentIndex - 1]);
    },
  });

  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 100,
  });

  const events = eventsData?.items ?? [];

  const hnEvents = useMemo(() => events.filter((e) => e.sourceType === "HN"), [events]);
  const ghEvents = useMemo(() => events.filter((e) => e.sourceType === "GITHUB"), [events]);
  const arxivEvents = useMemo(() => events.filter((e) => e.sourceType === "ARXIV"), [events]);

  const lastUpdate = events.length > 0 ? new Date(events[0].occurredAt) : null;

  const renderCard = (event: (typeof events)[0]) => (
    <CockpitEventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEvent?.id === event.id}
      onClick={() => selectEvent(event)}
    />
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Status Bar */}
      <StatusBar
        eventCount={events.length}
        lastUpdate={lastUpdate}
        isLoading={isLoading}
      />

      {/* Top Row: Briefing + Stats (desktop only) */}
      <div className="hidden md:grid md:grid-cols-2 gap-4" style={{ minHeight: "180px" }}>
        <BriefingCard />
        <StatsGrid
          totalCount={events.length}
          hnCount={hnEvents.length}
          ghCount={ghEvents.length}
          arxivCount={arxivEvents.length}
        />
      </div>

      {/* News Lanes */}
      <div className="flex-1 min-h-0">
        {/* Desktop: 3 columns */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 h-full">
          <NewsLane
            title="Hacker News"
            icon={<span className="text-orange-500">🔶</span>}
            count={hnEvents.length}
            accentColor="bg-orange-500/20 text-orange-400"
            glowClass="glass-glow-orange"
            isLoading={isLoading}
            delay={0.4}
          >
            {hnEvents.length > 0 ? hnEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema HN vijesti</p>
            )}
          </NewsLane>

          <NewsLane
            title="GitHub Trending"
            icon={<span>🐙</span>}
            count={ghEvents.length}
            accentColor="bg-purple-500/20 text-purple-400"
            glowClass="glass-glow-purple"
            isLoading={isLoading}
            delay={0.5}
          >
            {ghEvents.length > 0 ? ghEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema GitHub projekata</p>
            )}
          </NewsLane>

          <NewsLane
            title="arXiv Radovi"
            icon={<span>📄</span>}
            count={arxivEvents.length}
            accentColor="bg-green-500/20 text-green-400"
            glowClass="glass-glow-green"
            isLoading={isLoading}
            delay={0.6}
          >
            {arxivEvents.length > 0 ? arxivEvents.map(renderCard) : (
              <p className="text-muted-foreground text-sm text-center py-8">Nema radova</p>
            )}
          </NewsLane>
        </div>

        {/* Mobile: Single lane with swipe */}
        <div
          className="md:hidden h-full pb-20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeLane === "hn" && (
            <NewsLane title="Hacker News" icon="🔶" count={hnEvents.length} accentColor="bg-orange-500/20 text-orange-400" glowClass="" isLoading={isLoading}>
              {hnEvents.length > 0 ? hnEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema HN vijesti</p>}
            </NewsLane>
          )}
          {activeLane === "github" && (
            <NewsLane title="GitHub" icon="🐙" count={ghEvents.length} accentColor="bg-purple-500/20 text-purple-400" glowClass="" isLoading={isLoading}>
              {ghEvents.length > 0 ? ghEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema GitHub projekata</p>}
            </NewsLane>
          )}
          {activeLane === "arxiv" && (
            <NewsLane title="arXiv" icon="📄" count={arxivEvents.length} accentColor="bg-green-500/20 text-green-400" glowClass="" isLoading={isLoading}>
              {arxivEvents.length > 0 ? arxivEvents.map(renderCard) : <p className="text-muted-foreground text-sm text-center py-8">Nema radova</p>}
            </NewsLane>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 8: Verify typecheck**

Run: `pnpm typecheck --filter @genai/web`
Expected: No errors

**Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): glassmorphic cockpit landing page

Single-page hub with:
- Status bar with live indicator
- Daily briefing card
- Stats grid with source counts
- Three glassmorphic news lanes (HN, GitHub, arXiv)
- framer-motion staggered entrance animations
- Dark cockpit theme with glass effects and colored glows"
```

---

### Task 5: Update the header for cockpit feel

**Files:**
- Modify: `apps/web/src/components/layout/header.tsx`

**Step 1: Simplify header - remove TimeMachine, add cockpit style**

The header should be minimal and glassmorphic:
- Desktop: "GenAI Observatory" title with a live dot + search
- Mobile: Compact header with logo

Remove all TimeMachine imports and rendering. Remove `useTime()` hook usage. Apply `glass-header` class. Keep the search functionality.

**Step 2: Verify typecheck**

Run: `pnpm typecheck --filter @genai/web`

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/header.tsx
git commit -m "style(web): update header to glassmorphic cockpit style"
```

---

### Task 6: Force dark mode and add cockpit background

**Files:**
- Modify: `apps/web/src/app/layout.tsx` - Force dark class
- Modify: `apps/web/src/app/globals.css` - Add subtle grid background

**Step 1: Force dark mode in root layout**

In `layout.tsx`, add `className="dark"` to the `<html>` tag. The cockpit should always be dark.

**Step 2: Add subtle cockpit grid background**

In `globals.css`, add:
```css
body {
  background-image:
    radial-gradient(ellipse at top, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 100% 100%, 40px 40px, 40px 40px;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "style(web): force dark mode with cockpit grid background"
```

---

### Task 7: Build, deploy, and verify

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: All pass

**Step 2: Build**

Run: `pnpm build --filter @genai/web`
Expected: Build succeeds

**Step 3: Commit any remaining fixes**

**Step 4: Push and deploy**

```bash
git push origin main
```

Wait for GitHub Actions build (~6 min), then:
```bash
ssh deploy@100.97.156.41 "cd /opt/genai2 && docker compose pull && docker compose up -d --remove-orphans"
```

**Step 5: Verify site**

- Check https://v2.genai.hr loads the cockpit
- Verify events display in three lanes
- Verify glassmorphism effects render
- Verify mobile layout works
- Verify event selection works

---

## Summary

| Task | Description | Est. Size |
|------|-------------|-----------|
| 1 | Install framer-motion | Small |
| 2 | Remove Time Machine & TimeContext | Medium |
| 3 | Glassmorphism CSS utilities | Small |
| 4 | Cockpit landing page (main work) | Large |
| 5 | Update header for cockpit | Small |
| 6 | Force dark mode + grid background | Small |
| 7 | Build, deploy, verify | Small |
