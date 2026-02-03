# Phase 0: Observatory Wow Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a magical Observatory that makes users say "holy crap" - live multi-lane glass cockpit with Time Machine scrubber, search, and real data.

**Architecture:** Next.js 16 App Router with tRPC for type-safe queries. Three lanes showing events by category. Time Machine scrubber filters by timestamp. Context panel shows event details.

**Tech Stack:** Next.js 16, tRPC, Tailwind CSS v4, @tanstack/react-query, Prisma

---

## Current State Assessment

### Already Scaffolded
- `apps/web/` - Next.js app with Tailwind v4
- `apps/web/src/app/observatory/page.tsx` - Basic placeholder
- `apps/web/src/components/time-machine.tsx` - Controlled component
- `apps/web/src/components/lane.tsx` - Lane wrapper
- `apps/web/src/components/event-card.tsx` - Event display card
- `packages/trpc/` - tRPC routers (events, entities, topics) with placeholders
- `packages/db/` - Prisma schema with placeholder models

### Needs Implementation
- Sprint 0.1: tRPC client wiring + Next.js provider
- Sprint 0.2: Layout shell (sidebar, header, context panel)
- Sprint 0.3: Mock data → real tRPC queries
- Sprint 0.4: Search with instant results
- Sprint 0.5: Time Machine filtering logic
- Sprint 0.6: Context panel with keyboard navigation
- Sprint 0.7: Mobile responsive layout

---

## Task 1: tRPC Client + Next.js Provider

**Files:**
- Create: `apps/web/src/trpc/client.ts`
- Create: `apps/web/src/trpc/provider.tsx`
- Create: `apps/web/src/trpc/server.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `packages/trpc/package.json` (add exports)

**Step 1: Create tRPC client utility**

```typescript
// apps/web/src/trpc/client.ts
"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@genai/trpc";

export const trpc = createTRPCReact<AppRouter>();
```

**Step 2: Create tRPC provider wrapper**

```typescript
// apps/web/src/trpc/provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./client";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 3: Create server-side tRPC caller**

```typescript
// apps/web/src/trpc/server.ts
import "server-only";
import { appRouter, createCallerFactory } from "@genai/trpc";

const createCaller = createCallerFactory(appRouter);

export const serverTrpc = createCaller({});
```

**Step 4: Create barrel export**

```typescript
// apps/web/src/trpc/index.ts
export { trpc } from "./client";
export { TRPCProvider } from "./provider";
```

**Step 5: Update packages/trpc to export createCallerFactory**

```typescript
// packages/trpc/src/index.ts
export { appRouter, type AppRouter } from "./root";
export { createTRPCContext } from "./trpc";
export { createCallerFactory } from "./trpc";
```

**Step 6: Add createCallerFactory to trpc.ts**

```typescript
// Add to packages/trpc/src/trpc.ts after router export
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const createTRPCContext = async () => {
  return {};
};
```

**Step 7: Install dependencies**

Run: `pnpm add @trpc/react-query @trpc/client @tanstack/react-query --filter @genai/web`

**Step 8: Update layout.tsx with provider**

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
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
    <html lang="hr">
      <body className="min-h-screen bg-background font-sans antialiased">
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
```

**Step 9: Configure path alias**

Ensure `apps/web/tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Step 10: Run build to verify**

Run: `pnpm build`
Expected: All packages build successfully

**Step 11: Commit**

```bash
git add -A
git commit -m "feat(web): wire tRPC client with React Query provider"
```

---

## Task 2: API Route for tRPC in Next.js

**Files:**
- Create: `apps/web/src/app/api/trpc/[trpc]/route.ts`

**Step 1: Create tRPC API route handler**

```typescript
// apps/web/src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@genai/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

**Step 2: Install adapter**

Run: `pnpm add @trpc/server --filter @genai/web`

**Step 3: Run dev server to verify**

Run: `pnpm dev --filter @genai/web`
Expected: Server starts, /api/trpc endpoint responds

**Step 4: Commit**

```bash
git add apps/web/src/app/api/trpc
git commit -m "feat(web): add tRPC API route handler"
```

---

## Task 3: Observatory Layout Shell

**Files:**
- Create: `apps/web/src/components/layout/observatory-shell.tsx`
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/header.tsx`
- Create: `apps/web/src/components/layout/context-panel.tsx`
- Create: `apps/web/src/components/layout/index.ts`
- Modify: `apps/web/src/app/observatory/page.tsx`

**Step 1: Create header component**

```typescript
// apps/web/src/components/layout/header.tsx
"use client";

import { TimeMachine } from "@/components/time-machine";

interface HeaderProps {
  scrubberValue: number;
  onScrubberChange: (value: number) => void;
  catchUpCount?: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({
  scrubberValue,
  onScrubberChange,
  catchUpCount = 0,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="flex items-center gap-4 p-4">
        <h1 className="text-xl font-bold whitespace-nowrap">Observatory</h1>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Pretraži događaje, entitete, teme..."
          className="flex-1 rounded-md border px-3 py-2 bg-background"
        />
      </div>
      <div className="px-4 pb-4">
        <TimeMachine
          value={scrubberValue}
          onChange={onScrubberChange}
          catchUpCount={catchUpCount}
        />
      </div>
    </header>
  );
}
```

**Step 2: Create sidebar component**

```typescript
// apps/web/src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@genai/ui";

const navItems = [
  { href: "/observatory", label: "Observatory", icon: "🔭" },
  { href: "/daily", label: "Dnevni pregled", icon: "📰" },
  { href: "/explore", label: "Istraži", icon: "🔍" },
  { href: "/watchlists", label: "Praćenje", icon: "👁" },
  { href: "/library", label: "Knjižnica", icon: "📚" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card hidden lg:block">
      <div className="p-4 border-b">
        <Link href="/" className="text-xl font-bold">
          GenAI.hr
        </Link>
      </div>
      <nav className="p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 3: Create context panel component**

```typescript
// apps/web/src/components/layout/context-panel.tsx
"use client";

import type { ImpactLevel } from "@/components/event-card";

interface ContextPanelProps {
  selectedEvent: {
    id: string;
    title: string;
    titleHr?: string;
    occurredAt: Date;
    impactLevel: ImpactLevel;
    sourceCount: number;
    topics?: string[];
    summary?: string;
    summaryHr?: string;
  } | null;
  onClose: () => void;
}

export function ContextPanel({ selectedEvent, onClose }: ContextPanelProps) {
  if (!selectedEvent) {
    return (
      <aside className="w-80 border-l bg-card p-4 hidden xl:block">
        <p className="text-muted-foreground text-sm">
          Odaberi događaj za prikaz detalja
        </p>
        <p className="text-muted-foreground text-xs mt-2">
          Tipke: j/k za navigaciju, Enter za odabir
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l bg-card hidden xl:block overflow-y-auto">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Detalji</h2>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Zatvori"
        >
          ✕
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-lg">
            {selectedEvent.titleHr || selectedEvent.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedEvent.occurredAt.toLocaleDateString("hr-HR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {(selectedEvent.summaryHr || selectedEvent.summary) && (
          <div>
            <h4 className="text-sm font-medium mb-1">Sažetak</h4>
            <p className="text-sm text-muted-foreground">
              {selectedEvent.summaryHr || selectedEvent.summary}
            </p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-1">Izvori</h4>
          <p className="text-sm text-muted-foreground">
            {selectedEvent.sourceCount} izvora
          </p>
        </div>

        {selectedEvent.topics && selectedEvent.topics.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Teme</h4>
            <div className="flex flex-wrap gap-1">
              {selectedEvent.topics.map((topic) => (
                <span
                  key={topic}
                  className="text-xs bg-secondary px-2 py-0.5 rounded"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
```

**Step 4: Create observatory shell**

```typescript
// apps/web/src/components/layout/observatory-shell.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ContextPanel } from "./context-panel";
import type { ImpactLevel } from "@/components/event-card";

interface SelectedEvent {
  id: string;
  title: string;
  titleHr?: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics?: string[];
  summary?: string;
  summaryHr?: string;
}

interface ObservatoryShellProps {
  children: React.ReactNode;
}

export function ObservatoryShell({ children }: ObservatoryShellProps) {
  const [scrubberValue, setScrubberValue] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [catchUpCount, setCatchUpCount] = useState(0);

  // Calculate catch-up count based on scrubber position
  useEffect(() => {
    if (scrubberValue < 100) {
      // Mock: 1 event per 1% from now
      setCatchUpCount(Math.round((100 - scrubberValue) * 0.5));
    } else {
      setCatchUpCount(0);
    }
  }, [scrubberValue]);

  const handleCloseContext = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          scrubberValue={scrubberValue}
          onScrubberChange={setScrubberValue}
          catchUpCount={catchUpCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
          <ContextPanel
            selectedEvent={selectedEvent}
            onClose={handleCloseContext}
          />
        </main>
      </div>
    </div>
  );
}
```

**Step 5: Create barrel export**

```typescript
// apps/web/src/components/layout/index.ts
export { ObservatoryShell } from "./observatory-shell";
export { Sidebar } from "./sidebar";
export { Header } from "./header";
export { ContextPanel } from "./context-panel";
```

**Step 6: Run build to verify**

Run: `pnpm build`
Expected: Build passes

**Step 7: Commit**

```bash
git add apps/web/src/components/layout
git commit -m "feat(web): add Observatory layout shell with sidebar and context panel"
```

---

## Task 4: Wire Observatory Page with Layout + Mock Data

**Files:**
- Modify: `apps/web/src/app/observatory/page.tsx`
- Create: `apps/web/src/lib/mock-events.ts`

**Step 1: Create mock events data**

```typescript
// apps/web/src/lib/mock-events.ts
import type { ImpactLevel } from "@/components/event-card";

export interface MockEvent {
  id: string;
  title: string;
  titleHr: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics: string[];
  summary?: string;
  summaryHr?: string;
  category: "breaking" | "research" | "industry";
}

const now = new Date();

export const mockEvents: MockEvent[] = [
  {
    id: "1",
    title: "OpenAI announces GPT-5 with reasoning capabilities",
    titleHr: "OpenAI najavljuje GPT-5 s mogućnostima rasuđivanja",
    occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2h ago
    impactLevel: "BREAKING",
    sourceCount: 12,
    topics: ["OpenAI", "LLM", "GPT"],
    summaryHr: "OpenAI je danas najavio GPT-5, najnapredniji model umjetne inteligencije s poboljšanim mogućnostima rasuđivanja.",
    category: "breaking",
  },
  {
    id: "2",
    title: "Anthropic raises $2B Series C at $20B valuation",
    titleHr: "Anthropic prikupio 2 milijarde dolara u Seriji C",
    occurredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4h ago
    impactLevel: "HIGH",
    sourceCount: 8,
    topics: ["Anthropic", "Financiranje"],
    summaryHr: "Anthropic je zatvorio rundu financiranja Serije C od 2 milijarde dolara uz valuaciju od 20 milijardi dolara.",
    category: "breaking",
  },
  {
    id: "3",
    title: "New paper: Scaling Laws for Neural Language Models v2",
    titleHr: "Novi rad: Zakoni skaliranja za neuralne jezične modele v2",
    occurredAt: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6h ago
    impactLevel: "MEDIUM",
    sourceCount: 3,
    topics: ["Istraživanje", "Skaliranje"],
    category: "research",
  },
  {
    id: "4",
    title: "Google DeepMind achieves new SOTA on math reasoning",
    titleHr: "Google DeepMind postiže novi SOTA u matematičkom rasuđivanju",
    occurredAt: new Date(now.getTime() - 8 * 60 * 60 * 1000), // 8h ago
    impactLevel: "HIGH",
    sourceCount: 5,
    topics: ["DeepMind", "Benchmark", "Matematika"],
    category: "research",
  },
  {
    id: "5",
    title: "Meta releases Llama 4 open source",
    titleHr: "Meta objavljuje Llama 4 kao open source",
    occurredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12h ago
    impactLevel: "BREAKING",
    sourceCount: 15,
    topics: ["Meta", "Open Source", "LLM"],
    summaryHr: "Meta je objavila Llama 4, najnoviju verziju svojeg open source LLM-a.",
    category: "industry",
  },
  {
    id: "6",
    title: "Microsoft integrates Copilot into Windows kernel",
    titleHr: "Microsoft integrira Copilot u jezgru Windowsa",
    occurredAt: new Date(now.getTime() - 18 * 60 * 60 * 1000), // 18h ago
    impactLevel: "MEDIUM",
    sourceCount: 6,
    topics: ["Microsoft", "Copilot", "Windows"],
    category: "industry",
  },
  {
    id: "7",
    title: "NVIDIA announces next-gen AI chips for 2026",
    titleHr: "NVIDIA najavljuje novu generaciju AI čipova za 2026.",
    occurredAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24h ago
    impactLevel: "HIGH",
    sourceCount: 9,
    topics: ["NVIDIA", "Hardver"],
    category: "industry",
  },
  {
    id: "8",
    title: "New benchmark: HumanEval 2.0 released",
    titleHr: "Novi benchmark: HumanEval 2.0 objavljen",
    occurredAt: new Date(now.getTime() - 36 * 60 * 60 * 1000), // 36h ago
    impactLevel: "MEDIUM",
    sourceCount: 4,
    topics: ["Benchmark", "Evaluacija"],
    category: "research",
  },
];

export function filterEventsByTime(events: MockEvent[], scrubberValue: number): MockEvent[] {
  const now = Date.now();
  const rangeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const targetTime = now - rangeMs * (1 - scrubberValue / 100);

  return events.filter((event) => event.occurredAt.getTime() <= targetTime);
}

export function filterEventsByCategory(events: MockEvent[], category: MockEvent["category"]): MockEvent[] {
  return events.filter((event) => event.category === category);
}
```

**Step 2: Update Observatory page**

```typescript
// apps/web/src/app/observatory/page.tsx
"use client";

import { useState, useMemo } from "react";
import { ObservatoryShell } from "@/components/layout";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import {
  mockEvents,
  filterEventsByTime,
  filterEventsByCategory,
  type MockEvent,
} from "@/lib/mock-events";

export default function ObservatoryPage() {
  const [scrubberValue, setScrubberValue] = useState(100);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Filter events by time
  const visibleEvents = useMemo(
    () => filterEventsByTime(mockEvents, scrubberValue),
    [scrubberValue]
  );

  // Split into lanes
  const breakingEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "breaking"),
    [visibleEvents]
  );
  const researchEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "research"),
    [visibleEvents]
  );
  const industryEvents = useMemo(
    () => filterEventsByCategory(visibleEvents, "industry"),
    [visibleEvents]
  );

  const renderEventCard = (event: MockEvent) => (
    <EventCard
      key={event.id}
      id={event.id}
      title={event.title}
      titleHr={event.titleHr}
      occurredAt={event.occurredAt}
      impactLevel={event.impactLevel}
      sourceCount={event.sourceCount}
      topics={event.topics}
      isSelected={selectedEventId === event.id}
      onClick={() => setSelectedEventId(event.id)}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      <Lane
        title="Breaking"
        icon={<span className="text-red-500">🔴</span>}
        count={breakingEvents.length}
      >
        {breakingEvents.length > 0 ? (
          breakingEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema breaking vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>

      <Lane
        title="Istraživanje"
        icon={<span>🔬</span>}
        count={researchEvents.length}
      >
        {researchEvents.length > 0 ? (
          researchEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema istraživačkih vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>

      <Lane
        title="Industrija"
        icon={<span>🏢</span>}
        count={industryEvents.length}
      >
        {industryEvents.length > 0 ? (
          industryEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema industrijskih vijesti u ovom vremenskom razdoblju
          </p>
        )}
      </Lane>
    </div>
  );
}
```

**Step 3: Run dev server**

Run: `pnpm dev --filter @genai/web`
Expected: Observatory page shows 3 lanes with mock events

**Step 4: Commit**

```bash
git add apps/web/src/app/observatory apps/web/src/lib
git commit -m "feat(observatory): wire lanes with mock events and time filtering"
```

---

## Task 5: Create Observatory Layout Wrapper

**Files:**
- Create: `apps/web/src/app/observatory/layout.tsx`
- Modify: `apps/web/src/components/layout/observatory-shell.tsx`

**Step 1: Create Observatory layout**

```typescript
// apps/web/src/app/observatory/layout.tsx
import { ObservatoryShell } from "@/components/layout";

export default function ObservatoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ObservatoryShell>{children}</ObservatoryShell>;
}
```

**Step 2: Test layout**

Run: `pnpm dev --filter @genai/web`
Navigate to: http://localhost:3000/observatory
Expected: Full layout with sidebar, header, time machine, lanes

**Step 3: Commit**

```bash
git add apps/web/src/app/observatory/layout.tsx
git commit -m "feat(observatory): add layout wrapper with shell"
```

---

## Task 6: Connect tRPC Events Query

**Files:**
- Modify: `packages/trpc/src/routers/events.ts`
- Modify: `apps/web/src/app/observatory/page.tsx`

**Step 1: Enhance events router with mock data**

```typescript
// packages/trpc/src/routers/events.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Impact level enum
const ImpactLevel = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);

// Event schema
const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleHr: z.string().optional(),
  occurredAt: z.date(),
  impactLevel: ImpactLevel,
  sourceCount: z.number(),
  topics: z.array(z.string()),
  summary: z.string().optional(),
  summaryHr: z.string().optional(),
  status: z.string(),
});

// Mock data (will be replaced with Prisma in Phase 1)
const mockEvents = [
  {
    id: "1",
    title: "OpenAI announces GPT-5 with reasoning capabilities",
    titleHr: "OpenAI najavljuje GPT-5 s mogućnostima rasuđivanja",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    impactLevel: "BREAKING" as const,
    sourceCount: 12,
    topics: ["OpenAI", "LLM", "GPT"],
    summaryHr: "OpenAI je danas najavio GPT-5.",
    status: "PUBLISHED",
  },
  {
    id: "2",
    title: "Anthropic raises $2B Series C",
    titleHr: "Anthropic prikupio 2 milijarde dolara",
    occurredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    impactLevel: "HIGH" as const,
    sourceCount: 8,
    topics: ["Anthropic", "Financiranje"],
    status: "PUBLISHED",
  },
  {
    id: "3",
    title: "New scaling laws paper published",
    titleHr: "Objavljen novi rad o zakonima skaliranja",
    occurredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    impactLevel: "MEDIUM" as const,
    sourceCount: 3,
    topics: ["Istraživanje"],
    status: "PUBLISHED",
  },
];

export const eventsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        status: z.string().optional(),
        impactLevel: ImpactLevel.optional(),
        beforeTime: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      let items = [...mockEvents];

      // Filter by time
      if (input.beforeTime) {
        items = items.filter(
          (e) => e.occurredAt.getTime() <= input.beforeTime!.getTime()
        );
      }

      // Filter by impact
      if (input.impactLevel) {
        items = items.filter((e) => e.impactLevel === input.impactLevel);
      }

      // Filter by status
      if (input.status) {
        items = items.filter((e) => e.status === input.status);
      }

      // Sort by occurredAt desc
      items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

      // Apply limit
      items = items.slice(0, input.limit);

      return {
        items,
        nextCursor: null as string | null,
      };
    }),

  byId: publicProcedure.input(z.string()).query(async ({ input }) => {
    return mockEvents.find((e) => e.id === input) ?? null;
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();
      return mockEvents
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.titleHr?.toLowerCase().includes(q) ||
            e.topics.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, input.limit);
    }),
});
```

**Step 2: Update Observatory to use tRPC**

```typescript
// apps/web/src/app/observatory/page.tsx
"use client";

import { useState, useMemo } from "react";
import { Lane } from "@/components/lane";
import { EventCard } from "@/components/event-card";
import { trpc } from "@/trpc";

export default function ObservatoryPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Fetch events via tRPC
  const { data: eventsData, isLoading } = trpc.events.list.useQuery({
    limit: 50,
    status: "PUBLISHED",
  });

  const events = eventsData?.items ?? [];

  // Split into lanes by impact level
  const breakingEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "BREAKING"),
    [events]
  );
  const highEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "HIGH"),
    [events]
  );
  const otherEvents = useMemo(
    () => events.filter((e) => e.impactLevel === "MEDIUM" || e.impactLevel === "LOW"),
    [events]
  );

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
      isSelected={selectedEventId === event.id}
      onClick={() => setSelectedEventId(event.id)}
    />
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      <Lane
        title="Breaking"
        icon={<span className="text-red-500">🔴</span>}
        count={breakingEvents.length}
        isLoading={isLoading}
      >
        {breakingEvents.length > 0 ? (
          breakingEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema breaking vijesti
          </p>
        )}
      </Lane>

      <Lane
        title="Važno"
        icon={<span className="text-orange-500">🟠</span>}
        count={highEvents.length}
        isLoading={isLoading}
      >
        {highEvents.length > 0 ? (
          highEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema važnih vijesti
          </p>
        )}
      </Lane>

      <Lane
        title="Ostalo"
        icon={<span>📰</span>}
        count={otherEvents.length}
        isLoading={isLoading}
      >
        {otherEvents.length > 0 ? (
          otherEvents.map(renderEventCard)
        ) : (
          <p className="text-muted-foreground text-sm p-2">
            Nema ostalih vijesti
          </p>
        )}
      </Lane>
    </div>
  );
}
```

**Step 3: Run and verify**

Run: `pnpm dev --filter @genai/web`
Expected: Events loaded via tRPC, displayed in lanes

**Step 4: Commit**

```bash
git add packages/trpc/src/routers/events.ts apps/web/src/app/observatory/page.tsx
git commit -m "feat(observatory): connect tRPC events query with mock data"
```

---

## Task 7: Add Keyboard Navigation

**Files:**
- Create: `apps/web/src/hooks/use-keyboard-nav.ts`
- Modify: `apps/web/src/app/observatory/page.tsx`

**Step 1: Create keyboard navigation hook**

```typescript
// apps/web/src/hooks/use-keyboard-nav.ts
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
      // Don't intercept if user is typing in input
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
```

**Step 2: Create hooks barrel export**

```typescript
// apps/web/src/hooks/index.ts
export { useKeyboardNav } from "./use-keyboard-nav";
```

**Step 3: Test keyboard navigation**

Run: `pnpm dev --filter @genai/web`
Press j/k to navigate, [ and ] for time steps
Expected: Navigation works

**Step 4: Commit**

```bash
git add apps/web/src/hooks
git commit -m "feat(observatory): add keyboard navigation hook"
```

---

## Task 8: Build and Type Check

**Step 1: Run full build**

Run: `pnpm build`
Expected: All packages build successfully

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors (or only pre-existing)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and type errors"
```

---

## Task 9: Final Push and CI Verification

**Step 1: Push to origin**

```bash
git push origin main
```

**Step 2: Verify CI passes**

Check: https://github.com/Wandeon/GenAI2/actions
Expected: All checks green

---

## Summary

After completing all tasks, the Observatory will have:

- tRPC client wired to Next.js with React Query
- Layout shell with sidebar, header, and context panel
- Time Machine scrubber (visual, filtering in next sprint)
- Three lanes displaying events by impact level
- Mock data served via tRPC (ready for Prisma swap)
- Keyboard navigation foundation
- Croatian language throughout UI

**Next Steps (Sprint 0.2+):**
- Wire Time Machine to actually filter tRPC query by time
- Search bar with instant results
- Context panel showing selected event details
- Mobile responsive layout with tabs
