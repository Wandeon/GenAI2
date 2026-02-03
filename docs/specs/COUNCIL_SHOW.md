# Council Show / GM Live - Feature Specification

> **Status:** PLANNED (Post-Phase 8)
> **Surface:** Daily Run
> **Goal:** NotebookLM-style dynamic conversation, but evidence-grounded

## Overview

Replace static daily briefings with a **thinking system** that generates dynamic "roundtable" episodes. Not scripted, not random - a Director/Cast model that decides how many turns, who speaks, when to challenge, when to stop.

## Core Architecture: Director + Cast

### Director (Planner)

A small, strict controller that does **no creativity**.

Responsibilities:
- Which persona speaks next
- What the next message's job is (move type)
- When the conversation should end
- What evidence must be referenced

Think of it as "showrunner". Uses cheap model (Gemini Flash).

### Cast (Personas)

Creative, but constrained. They speak only when the Director tells them to, and they must obey the task.

Starting cast (3 personas):

| Persona | Role | Voice |
|---------|------|-------|
| **GM** | Host | Keeps tempo, transitions, summarizes. Slight attitude allowed. |
| **Engineer** | Builder brain | "What does this actually mean technically? What's plausible?" |
| **Skeptic** | Hype filter | Attacks weak evidence, points out incentives, demands confirmation. |

Future 4th persona:
| **Operator** | DevOps/cost reality | Ties into real-world shipping, deployment, cost implications. |

---

## Episode Format: Daily Show

**Inputs:**
- Top N events of the day (already deduped via Event pipeline)
- Evidence snapshots for each event
- Topic clusters (from topic assignment)

**Output:**
- One conversational "roundtable" covering multiple events
- Structured as segments, each with multiple turns
- Every claim traced to evidence

---

## Move Types (Director's Vocabulary)

Each turn is one "move":

| Move Type | Description | Typical Persona |
|-----------|-------------|-----------------|
| `SETUP` | Introduces topic cluster | GM |
| `TECH_READ` | Explains what's technically real | Engineer |
| `RISK_CHECK` | Attacks weak claims, asks "what's missing?" | Skeptic |
| `ECON_IMPACT` | Ties to business/market implications | Analyst (future) |
| `CROSS_EXAM` | One persona directly challenges another | Any |
| `EVIDENCE_CALL` | Demands second source or clarifies disagreement | Skeptic |
| `TAKEAWAY` | Summarizes what's true vs unknown | GM |
| `CUT` | End segment, move to next event cluster | Director |
| `COLD_OPEN` | Optional subtle humor (rare) | GM |

---

## Episode Generation Pipeline

### Step A: Build the Rundown (Director)

Input: 10-30 candidate events from the day

Director outputs a plan:
```json
{
  "date": "2026-02-03",
  "segments": [
    {
      "id": "seg-1",
      "title": "Model releases + benchmarks",
      "eventIds": ["evt-123", "evt-456", "evt-789"],
      "turnPlan": [
        { "move": "SETUP", "persona": "GM" },
        { "move": "TECH_READ", "persona": "Engineer" },
        { "move": "RISK_CHECK", "persona": "Skeptic" },
        { "move": "CROSS_EXAM", "persona": "Engineer", "target": "Skeptic" },
        { "move": "TAKEAWAY", "persona": "GM" },
        { "move": "CUT" }
      ]
    },
    {
      "id": "seg-2",
      "title": "Regulation + lawsuits",
      "eventIds": ["evt-101", "evt-102"],
      "turnPlan": [
        { "move": "SETUP", "persona": "GM" },
        { "move": "RISK_CHECK", "persona": "Skeptic" },
        { "move": "EVIDENCE_CALL", "persona": "Skeptic" },
        { "move": "TAKEAWAY", "persona": "GM" },
        { "move": "CUT" }
      ]
    }
  ]
}
```

Some segments: 3 turns. Some: 7 turns. That's the dynamism.

### Step B: Generate Turns Sequentially (Cast)

Each persona receives:
- The segment's events and evidence links
- The conversation so far
- The Director's instruction for that turn

They must:
- Cite which event(s) by eventId
- Stay under word cap (e.g., 150 words)
- Mark uncertainty explicitly
- Never invent claims

### Step C: Stop Rules

Director ends a segment when:
- The segment has a TAKEAWAY
- No open EVIDENCE_CALL remains unresolved
- Turn budget reached (cost control)

---

## Hard Rules (Slop Prevention)

1. Every segment references 2-6 concrete events (not "AI in general")
2. Any strong claim triggers EVIDENCE_CALL if sources are weak
3. Skeptic can force "We don't know yet" as acceptable conclusion
4. No "everyone agrees", no invented reactions, no "internet is buzzing"
5. All claims trace to EvidenceSnapshot

---

## Cost Control

- Director: cheap model (Gemini Flash)
- Hard turns only: expensive model (Gemini Pro)
- Cap: 12-18 total turns per episode
- Budget: ~$0.10-0.20 per daily episode

---

## Data Model

New artifact type: `DAILY_SHOW`

```prisma
model DailyShowEpisode {
  id            String   @id @default(cuid())
  date          DateTime @unique @db.Date

  // Structured content
  segments      Json     // Array of segments with turns
  showNotes     String?  // Compact summary at end

  // Provenance
  directorRunId String   // LLMRun for planning

  generatedAt   DateTime @default(now())

  @@map("daily_show_episodes")
}
```

Segment/Turn structure in JSON:
```typescript
interface DailyShowSegment {
  id: string;
  title: string;
  eventIds: string[];
  turns: DailyShowTurn[];
}

interface DailyShowTurn {
  persona: "GM" | "Engineer" | "Skeptic" | "Operator";
  moveType: MoveType;
  text: string;
  textHr: string;  // Croatian translation
  referencedEventIds: string[];
  runId: string;   // LLMRun for this turn
}
```

---

## UI Surface: Daily Run

```
┌─────────────────────────────────────────────────────────────────┐
│  Daily Run - 3. veljače 2026.                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TOP 5 EVENTS                                           │   │
│  │  [Event cards as normal]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎙️ GM LIVE                                              │   │
│  │                                                          │   │
│  │  ▼ Segment 1: Model Releases                            │   │
│  │    ┌──────────────────────────────────────────────────┐ │   │
│  │    │ GM: "Danas imamo tri velika puštanja modela..."  │ │   │
│  │    │     [evt-123] [evt-456]                          │ │   │
│  │    ├──────────────────────────────────────────────────┤ │   │
│  │    │ Engineer: "Tehnički, ovaj benchmark..."          │ │   │
│  │    │     [evt-123]                                    │ │   │
│  │    ├──────────────────────────────────────────────────┤ │   │
│  │    │ Skeptic: "Čekaj, ali metodologija..."            │ │   │
│  │    │     [evt-456]                                    │ │   │
│  │    └──────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │  ▶ Segment 2: Regulation (collapsed)                    │   │
│  │  ▶ Segment 3: Funding Rounds (collapsed)                │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Click event chip → opens evidence panel.

---

## Persona Contracts (To Be Written)

Each persona needs a formal contract like GM's existing one:

- Voice constraints
- Forbidden behaviors
- Required disclosures
- Croatian language rules
- Output schema

---

## Decision: Daily-Only First

Start with **Daily-only episodes**. One great conversation per day.

Do NOT do per-event threads initially. Daily is:
- Clearest differentiator
- Easiest to keep high quality
- Best cost/value ratio

Per-event threads can be added in a future phase if needed.

---

## Implementation Phases

### Phase 9A: Director Pipeline
- Director prompt and rundown generator
- Segment clustering from events
- Turn plan generation
- Cost tracking

### Phase 9B: Cast Personas
- GM persona (extend existing contract)
- Engineer persona contract + prompt
- Skeptic persona contract + prompt
- Turn generation pipeline

### Phase 9C: Episode Assembly
- Sequential turn generation
- Evidence linking
- Croatian translation
- Show notes summary

### Phase 9D: UI Integration
- Daily Run surface update
- Episode player component
- Segment collapse/expand
- Event chip linking

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Episode generation time | < 2 minutes |
| Cost per episode | < $0.20 |
| Evidence coverage | 100% of claims linked |
| User engagement (time on Daily Run) | +50% vs static |
| "Holy crap this is good" reactions | Qualitative |

---

## Open Questions

1. Should episodes be regenerated if new high-impact events arrive mid-day?
2. Audio generation (TTS) for podcast-style consumption?
3. User ability to "ask a question" that gets answered in next episode?
4. Archive of past episodes browsable?

---

## References

- NotebookLM's "Audio Overview" feature
- Podcast formats (The Daily, Hard Fork)
- GM Identity Contract (`packages/llm/src/gm/contract.ts`)
