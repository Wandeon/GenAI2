// ============================================================================
// DIRECTOR MODULE - Rule-based turn planner for Council Roundtable
// ============================================================================
// Deterministic, no LLM call, free. Plans the structure of each episode.
// The Director decides WHO speaks, WHEN, and ABOUT WHAT.
// The Cast module then generates the actual dialogue per turn.

import type { EventForBriefing } from "./daily-briefing.types";

// ============================================================================
// Types
// ============================================================================

export interface TurnPlan {
  persona: "GM" | "Engineer" | "Skeptic";
  moveType: "SETUP" | "TECH_READ" | "RISK_CHECK" | "CROSS_EXAM" | "EVIDENCE_CALL" | "TAKEAWAY" | "CUT";
  eventRefs: number[];
  instruction: string;
}

export interface EpisodePlan {
  turns: TurnPlan[];
  eventCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_TURNS = 18;
const MAX_EVENT_CLUSTERS = 5;

// ============================================================================
// Director Logic
// ============================================================================

/**
 * Plan an episode structure from the day's events.
 * Rule-based: GM opens, personas debate each event cluster, GM closes.
 */
export function planEpisode(events: EventForBriefing[]): EpisodePlan {
  const eventCount = events.length;
  if (eventCount === 0) {
    return { turns: [], eventCount: 0 };
  }

  const turns: TurnPlan[] = [];
  const topEvents = events.slice(0, MAX_EVENT_CLUSTERS);
  const topRefs = topEvents.map((_, i) => i + 1);

  // Always start: GM SETUP referencing top events
  turns.push({
    persona: "GM",
    moveType: "SETUP",
    eventRefs: topRefs.slice(0, 3),
    instruction: `Open the show. Introduce today's ${eventCount} events, highlighting the top ${Math.min(3, eventCount)}. Set the energy and frame what matters most today.`,
  });

  // For each event cluster: Engineer analyzes, Skeptic challenges
  for (let i = 0; i < topEvents.length; i++) {
    const ref = i + 1;
    const event = topEvents[i];
    const isHighImpact = event !== undefined && event.importance <= 2;

    // CUT between clusters (skip before first)
    if (i > 0) {
      turns.push({
        persona: "GM",
        moveType: "CUT",
        eventRefs: [],
        instruction: "Transition to next topic.",
      });
    }

    // Engineer: technical analysis
    turns.push({
      persona: "Engineer",
      moveType: "TECH_READ",
      eventRefs: [ref],
      instruction: `Analyze the technical claims in event #${ref}. What's real, what's hype? Cite specific numbers, benchmarks, or methodologies.`,
    });

    // Skeptic: challenge or verify
    turns.push({
      persona: "Skeptic",
      moveType: i % 2 === 0 ? "RISK_CHECK" : "CROSS_EXAM",
      eventRefs: [ref],
      instruction: i % 2 === 0
        ? `Check the risks and gaps in event #${ref}. What evidence is missing? Who benefits from this narrative?`
        : `Challenge the Engineer's take on event #${ref}. What's the other side? Where's the second source?`,
    });

    // High-impact events get an extra exchange
    if (isHighImpact && turns.length < MAX_TURNS - 2) {
      turns.push({
        persona: "Engineer",
        moveType: "CROSS_EXAM",
        eventRefs: [ref],
        instruction: `Respond to the Skeptic's challenge on event #${ref}. Defend or concede with evidence.`,
      });
    }

    // Stay under cap (leave room for TAKEAWAY)
    if (turns.length >= MAX_TURNS - 1) {
      break;
    }
  }

  // Always end: GM TAKEAWAY
  turns.push({
    persona: "GM",
    moveType: "TAKEAWAY",
    eventRefs: topRefs.slice(0, 3),
    instruction: `Wrap up the show. What's the one thing the audience should remember today? Synthesize the key takeaways from the discussion.`,
  });

  return { turns, eventCount };
}
