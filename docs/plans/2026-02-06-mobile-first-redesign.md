# Mobile-First Redesign

**Date:** 2026-02-06
**Status:** Approved design
**Design sentence:** "Readable like a morning brief, sharp like a dev tool."

---

## 1. Design Foundation

### Visual System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FFFFFF` | Page background |
| Surface | `#FAFAF9` | Card/section backgrounds |
| Text primary | `#1C1917` | Titles, body copy |
| Text secondary | `#78716C` | Meta text, labels |
| Border | `#E7E5E3` | Dividers, card borders (1px) |
| Accent (amber) | `#F59E0B` | Selection, active tab, CTAs, expandable links, HIGH impact dot |
| Alert (red) | `#EF4444` | BREAKING impact dot only |

No glassmorphism. No glows. No gradients. No grid background pattern. White space carries the hierarchy.

### Typography

- **Geist Sans:** Titles, summaries, roundtable text, buttons, body copy
- **Geist Mono:** Timestamps, confidence labels, `[SOURCE]` tags, counts, IDs, cost/latency meta

Rule: if it's data or metadata, it's Geist Mono. If it's prose or UI, it's Geist Sans.

### Status System

| Signal | Rendering |
|--------|-----------|
| Impact BREAKING | Red dot before title |
| Impact HIGH | Amber dot before title |
| Impact MEDIUM | No dot |
| Impact LOW | No dot |
| Confidence | Geist Mono text only: `HIGH` / `MED` / `LOW`, no color |
| Source identity | Geist Mono gray tag: `[HN]` `[arXiv]` `[GitHub]` |
| Trust tier | Geist Mono gray: `AUTHORITATIVE` / `STANDARD` / `LOW` |

---

## 2. Mobile Layout (375px, primary surface)

### Navigation

Bottom tab bar, 2 tabs only:

- **Dnevni** (Daily) — default active, amber underline indicator
- **Uzivo** (Live) — unified feed, secondary

No sidebar. No hamburger. Explore and Watchlists are accessible via links within content (entity chips, search icon), not via top-level nav.

### Header (sticky, ~48px)

- Left: "GenAI" wordmark, Geist Sans semibold
- Right: Search icon (magnifying glass) — tap opens full-screen search overlay (reuses explore search page)
- Thin bottom border (`#E7E5E3`), no glassmorphism

### Daily Tab (Home Screen)

Top to bottom:

#### 2a. Date Header

```
Cetvrtak, 6. veljace 2026.
5 kljucnih dogadaja · 12 izvora        ← Geist Mono, gray
```

#### 2b. Council Roundtable Teaser

- Collapsed by default
- Shows first 1-2 speaker turns as preview text (GM + one persona)
- Amber text link: "Prikazi raspravu (6)"
- Expands inline as accordion
- Thin amber left border to distinguish from event list

#### 2c. Ranked Event List

Numbered 1-10. Each row in collapsed state:

```
1  ● OpenAI releases GPT-5 with reasoning
   [HN] · MED · 3 izvora · 14:32
```

- Rank number: Geist Mono, large, gray
- Title: Geist Sans, semibold, 1 line, truncated
- Impact dot: red (BREAKING) or amber (HIGH), before title. Nothing for MEDIUM/LOW.
- Meta row: `[SOURCE]` + confidence + source count + time, all Geist Mono small gray

Tap row -> expands accordion. **One open at a time.**

#### 2d. Expanded Event (Accordion)

```
1  ● OpenAI releases GPT-5 with reasoning
   [HN] · MED · 3 izvora · 14:32

   Sto se dogodilo
   OpenAI announced GPT-5, their latest model featuring
   native chain-of-thought reasoning. The model scores...

   Zasto je vazno
   This represents a significant leap in reasoning capability
   that could reshape enterprise AI adoption...

   Izvori ▸                              ← collapsible
   [OpenAI] [Anthropic] [GPT-5]         ← entity chips, tappable
   Otvori dosje →                        ← amber link
```

Blocks in order:
1. **Sto se dogodilo** — 2-3 sentences, Geist Sans
2. **Zasto je vazno** — 1-2 sentences, Geist Sans
3. **Izvori** — Collapsible row of source links, Geist Mono small
4. **Entity chips** — Tap navigates to `/explore/[slug]`
5. **"Otvori dosje"** — Amber text link, deep-links to full event detail

#### 2e. Catch-up Section (conditional)

Only shown for returning users with missed events:

```
Propustili ste 23 dogadaja              ← Geist Sans
[Nadoknadite]                           ← amber button
```

### Live Tab

- Single unified feed, all sources mixed, sorted by time descending
- Same card format as ranked list but without rank numbers
- Infinite scroll
- Source tag on each item is the only source indicator
- No sections, no grouping

---

## 3. Desktop Layout (1024px+)

### Philosophy

Same content hierarchy as mobile, just more room. Daily Run is still the default landing page. Observatory is accessible but not the homepage.

### Navigation: Icon Rail

Left sidebar, narrow:
- Collapsed: 56px, icons only
- Expanded: 200px on hover, shows labels

Items (top to bottom):
1. Daily (newspaper icon)
2. Live (radio icon)
3. Explore (search icon)
4. Watchlists (eye icon)
5. Observatory (grid icon) — last, it's the power tool

Active indicator: amber left border on active icon.

### Header (sticky)

- Left: "GenAI Observatory" wordmark, Geist Sans
- Center: Search bar (always visible, not icon-only). Reuses explore search with debounce + results dropdown
- Right: "last updated" timestamp, Geist Mono gray
- Thin bottom border, no glassmorphism

### Daily Page (max-width 720px, centered)

**Don't make it wider, make it more readable.** Narrow centered column like Substack/Medium. White space on sides carries the "morning paper" authority.

Same structure as mobile:
- Date header
- Roundtable teaser (2-3 preview turns instead of 1-2)
- Ranked accordion list (more breathing room in expanded state)
- Catch-up section

### Observatory Page (power user surface)

Multi-column layout — the only page that uses it:
- 3-column grid of source sections (News / Community / Research row 1, Tools / Video row 2)
- Each section: compact event list (title + meta only, no expand)
- Click event: right panel slides in (context panel, restyled to match new visual system)
- Time Machine scrubber: white track, amber thumb, Geist Mono labels

### Explore/Dossier Pages (max-width 720px, centered)

Same narrow centered column as Daily:
- Entity header, timeline, related entities stack vertically
- Graph section (if shown) gets full width below the centered column

### Rule

Only Observatory uses multi-column layout. Everything else is a single readable column.

---

## 4. Implementation Strategy

### Principle

This is a visual reskin, not a rewrite. tRPC queries, data layer, and component logic stay the same. We change CSS, layout structure, and component templates.

### What Changes

| Area | Change |
|------|--------|
| Theme | Replace dark glassmorphism with light warm-mono palette |
| Fonts | Geist Sans + Geist Mono via `next/font` |
| Root layout | Remove `className="dark"`, remove grid pattern |
| Mobile nav | Replace sidebar with bottom tab bar (2 tabs) |
| Desktop nav | Replace 264px sidebar with 56px icon rail |
| Daily page | Rebuild as ranked accordion list with roundtable teaser |
| Observatory | Restyle: plain white cards, thin borders, no glows |
| All components | New palette: white bg, warm grays, amber accents, Geist fonts |
| Routes | `/` redirects to `/daily` instead of `/observatory` |

### New Components (~5)

| Component | Purpose |
|-----------|---------|
| `BottomTabBar` | Mobile navigation (2 tabs: Dnevni, Uzivo) |
| `IconRail` | Desktop sidebar (collapsed 56px / expanded 200px) |
| `RankedEventList` | Accordion list with numbered items, one-open-at-a-time |
| `RoundtableTeaser` | Collapsed preview of council roundtable turns |
| `LiveFeed` | Unified time-sorted feed for Live tab |

### New Route

| Route | Purpose |
|-------|---------|
| `/live` | Unified feed (Live tab) |

### What Gets Deleted

- All `glass-*` CSS utilities (glass, glass-card, glass-header, glass-glow-*)
- Background grid/gradient pattern
- Color glow system (red, cyan, orange, purple, green, yellow, pink)
- Source-section colored borders
- Dark mode CSS variables (light-only for now)
- `className="dark"` from root layout

### What Stays Untouched

- All tRPC routers and queries
- All Prisma schema and data layer
- Worker/processor pipeline
- Explore page logic (just restyled)
- Entity component logic (just restyled)
- Context panel logic (just restyled)
- Time Machine logic (just restyled)
- Session/auth system

### Estimated Scope

~15 files modified, ~5 new components, 0 data layer changes.

---

## 5. Design Reference

### Mobile Wireframe (Daily Tab)

```
┌─────────────────────────────┐
│ GenAI                    🔍 │  ← header
├─────────────────────────────┤
│                             │
│ Cetvrtak, 6. veljace 2026.  │
│ 5 dogadaja · 12 izvora      │
│                             │
│ ┃ GM: Danasnji dan donosi   │  ← roundtable teaser
│ ┃ znacajan pomak u...       │     (amber left border)
│ ┃ Prikazi raspravu (6)      │
│                             │
│ 1  ● Title of top event     │  ← ranked list
│    [HN] · HIGH · 3 · 14:32 │
│                             │
│ 2  Title of second event    │
│    [arXiv] · MED · 2 · 13:1│
│                             │
│ 3  Title of third event     │
│    [GH] · LOW · 1 · 12:45  │
│                             │
│ ...                         │
│                             │
├─────────────────────────────┤
│   Dnevni        Uzivo       │  ← bottom tabs
│   ━━━━━━                    │     (amber underline)
└─────────────────────────────┘
```

### Mobile Wireframe (Expanded Event)

```
│ 2  Title of second event    │
│    [arXiv] · MED · 2 · 13:1│
│                             │
│    Sto se dogodilo          │
│    Two sentences describing │
│    what actually happened   │
│    in this event...         │
│                             │
│    Zasto je vazno           │
│    One sentence on why this │
│    matters to the reader.   │
│                             │
│    Izvori ▸                 │
│    [Entity1] [Entity2]      │
│    Otvori dosje →           │
│                             │
│ 3  Title of third event     │
```

### Desktop Wireframe (Daily)

```
┌──┬──────────────────────────────────────────────┐
│📰│                                              │
│📻│  GenAI Observatory    [  Search...  ]  15:32 │
│🔍│  ──────────────────────────────────────────  │
│👁│                                              │
│▦ │       Cetvrtak, 6. veljace 2026.             │
│  │       5 dogadaja · 12 izvora                 │
│  │                                              │
│  │       ┃ GM: Danasnji dan...                  │
│  │       ┃ Prikazi raspravu (6)                 │
│  │                                              │
│  │       1  ● Top event title                   │
│  │          [HN] · HIGH · 3 izvora · 14:32      │
│  │                                              │
│  │       2  Second event title                  │
│  │          [arXiv] · MED · 2 izvora · 13:10    │
│  │                                              │
│  │       ...                                    │
│  │                                              │
└──┴──────────────────────────────────────────────┘
```
