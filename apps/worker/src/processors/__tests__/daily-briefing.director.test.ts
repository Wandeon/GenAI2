import { describe, it, expect } from "vitest";

import { planEpisode } from "../daily-briefing.director";
import type { TurnPlan, EpisodePlan } from "../daily-briefing.director";
import type { EventForBriefing } from "../daily-briefing.types";

// ============================================================================
// TEST DATA
// ============================================================================

function makeEvent(id: string, importance: number): EventForBriefing {
  return {
    id,
    title: `Event ${id}`,
    titleHr: `Događaj ${id}`,
    importance,
    occurredAt: new Date("2026-02-05"),
    artifacts: [
      { artifactType: "HEADLINE", payload: { en: `Event ${id}`, hr: `Događaj ${id}` } },
      { artifactType: "SUMMARY", payload: { en: `Summary of ${id}`, hr: `Sažetak ${id}` } },
    ],
    evidence: [{ snapshot: { source: { id: `source-${id}` } } }],
    mentions: [{ entity: { name: `Entity-${id}` } }],
  };
}

const oneEvent = [makeEvent("1", 1)];
const threeEvents = [makeEvent("1", 1), makeEvent("2", 3), makeEvent("3", 5)];
const fiveEvents = [
  makeEvent("1", 1),
  makeEvent("2", 2),
  makeEvent("3", 3),
  makeEvent("4", 4),
  makeEvent("5", 5),
];
const tenEvents = Array.from({ length: 10 }, (_, i) => makeEvent(`${i + 1}`, i + 1));

// ============================================================================
// TESTS
// ============================================================================

describe("planEpisode", () => {
  it("returns empty plan for no events", () => {
    const plan = planEpisode([]);
    expect(plan.turns).toEqual([]);
    expect(plan.eventCount).toBe(0);
  });

  it("returns valid plan structure", () => {
    const plan = planEpisode(threeEvents);
    expect(plan.eventCount).toBe(3);
    expect(plan.turns.length).toBeGreaterThanOrEqual(4);

    for (const turn of plan.turns) {
      expect(["GM", "Engineer", "Skeptic"]).toContain(turn.persona);
      expect(turn.instruction).toBeTruthy();
      expect(Array.isArray(turn.eventRefs)).toBe(true);
    }
  });

  it("first turn is always GM SETUP", () => {
    const plan = planEpisode(threeEvents);
    const first = plan.turns[0] as TurnPlan;
    expect(first.persona).toBe("GM");
    expect(first.moveType).toBe("SETUP");
  });

  it("last turn is always GM TAKEAWAY", () => {
    const plan = planEpisode(threeEvents);
    const last = plan.turns[plan.turns.length - 1] as TurnPlan;
    expect(last.persona).toBe("GM");
    expect(last.moveType).toBe("TAKEAWAY");
  });

  it("contains at least one TECH_READ", () => {
    const plan = planEpisode(threeEvents);
    const techReads = plan.turns.filter((t) => t.moveType === "TECH_READ");
    expect(techReads.length).toBeGreaterThanOrEqual(1);
  });

  it("contains at least one RISK_CHECK or CROSS_EXAM from Skeptic", () => {
    const plan = planEpisode(threeEvents);
    const skepticTurns = plan.turns.filter(
      (t) => t.persona === "Skeptic" && (t.moveType === "RISK_CHECK" || t.moveType === "CROSS_EXAM")
    );
    expect(skepticTurns.length).toBeGreaterThanOrEqual(1);
  });

  it("includes CUT between event clusters", () => {
    const plan = planEpisode(threeEvents);
    const cuts = plan.turns.filter((t) => t.moveType === "CUT");
    // 3 events = 2 CUTs between clusters
    expect(cuts.length).toBe(2);
  });

  it("every non-SETUP/TAKEAWAY/CUT turn has eventRefs", () => {
    const plan = planEpisode(fiveEvents);
    const contentTurns = plan.turns.filter(
      (t) => !["SETUP", "TAKEAWAY", "CUT"].includes(t.moveType)
    );
    for (const turn of contentTurns) {
      expect(turn.eventRefs.length).toBeGreaterThan(0);
    }
  });

  it("handles single event", () => {
    const plan = planEpisode(oneEvent);
    expect(plan.eventCount).toBe(1);
    expect(plan.turns.length).toBeGreaterThanOrEqual(3); // SETUP + TECH_READ + TAKEAWAY minimum

    const first = plan.turns[0] as TurnPlan;
    const last = plan.turns[plan.turns.length - 1] as TurnPlan;
    expect(first.moveType).toBe("SETUP");
    expect(last.moveType).toBe("TAKEAWAY");
  });

  it("handles many events without exceeding turn cap", () => {
    const plan = planEpisode(tenEvents);
    // Max turns is 18 (from Director constant) + TAKEAWAY = 19 max
    expect(plan.turns.length).toBeLessThanOrEqual(19);
  });

  it("high-impact events get extra CROSS_EXAM from Engineer", () => {
    // Events with importance <= 2 are high-impact
    const highImpactEvents = [makeEvent("1", 1), makeEvent("2", 2)];
    const plan = planEpisode(highImpactEvents);

    const engineerCrossExams = plan.turns.filter(
      (t) => t.persona === "Engineer" && t.moveType === "CROSS_EXAM"
    );
    expect(engineerCrossExams.length).toBeGreaterThanOrEqual(1);
  });

  it("SETUP references top events", () => {
    const plan = planEpisode(fiveEvents);
    const setup = plan.turns[0] as TurnPlan;
    expect(setup.eventRefs.length).toBeGreaterThan(0);
    expect(setup.eventRefs.length).toBeLessThanOrEqual(3);
  });

  it("TAKEAWAY references top events", () => {
    const plan = planEpisode(fiveEvents);
    const takeaway = plan.turns[plan.turns.length - 1] as TurnPlan;
    expect(takeaway.eventRefs.length).toBeGreaterThan(0);
  });

  it("CUT turns have empty eventRefs", () => {
    const plan: EpisodePlan = planEpisode(threeEvents);
    const cuts = plan.turns.filter((t) => t.moveType === "CUT");
    for (const cut of cuts) {
      expect(cut.eventRefs).toEqual([]);
    }
  });
});
