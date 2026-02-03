// ============================================================================
// GRAPH SAFETY GATE - Unit Tests
// ============================================================================
// Tests the safety gate validation for relationships based on:
// - Risk level (LOW, MEDIUM, HIGH)
// - Trust tier (AUTHORITATIVE, STANDARD, LOW)
// - Source count
//
// Key principle tested: Model confidence is NEVER used for approval.

import { describe, it, expect } from "vitest";
import {
  validateRelationship,
  getRiskLevel,
  isHighRisk,
  type RelationshipProposal,
  type TrustTier,
  type RelationType,
} from "../graph-safety";

// ============================================================================
// HELPER FACTORY
// ============================================================================

function createProposal(
  type: RelationType,
  overrides?: Partial<RelationshipProposal>
): RelationshipProposal {
  return {
    sourceEntity: "entity-source-123",
    targetEntity: "entity-target-456",
    type,
    eventId: "event-789",
    modelConfidence: 0.95,
    ...overrides,
  };
}

// ============================================================================
// getRiskLevel TESTS
// ============================================================================

describe("getRiskLevel", () => {
  it("returns LOW for RELEASED, ANNOUNCED, PUBLISHED", () => {
    expect(getRiskLevel("RELEASED")).toBe("LOW");
    expect(getRiskLevel("ANNOUNCED")).toBe("LOW");
    expect(getRiskLevel("PUBLISHED")).toBe("LOW");
  });

  it("returns MEDIUM for PARTNERED, INTEGRATED, FUNDED", () => {
    expect(getRiskLevel("PARTNERED")).toBe("MEDIUM");
    expect(getRiskLevel("INTEGRATED")).toBe("MEDIUM");
    expect(getRiskLevel("FUNDED")).toBe("MEDIUM");
  });

  it("returns HIGH for ACQUIRED, BANNED, BEATS, CRITICIZED", () => {
    expect(getRiskLevel("ACQUIRED")).toBe("HIGH");
    expect(getRiskLevel("BANNED")).toBe("HIGH");
    expect(getRiskLevel("BEATS")).toBe("HIGH");
    expect(getRiskLevel("CRITICIZED")).toBe("HIGH");
  });
});

// ============================================================================
// isHighRisk TESTS
// ============================================================================

describe("isHighRisk", () => {
  it("returns true for high-risk relationship types", () => {
    expect(isHighRisk("ACQUIRED")).toBe(true);
    expect(isHighRisk("BANNED")).toBe(true);
    expect(isHighRisk("BEATS")).toBe(true);
    expect(isHighRisk("CRITICIZED")).toBe(true);
  });

  it("returns false for medium-risk relationship types", () => {
    expect(isHighRisk("PARTNERED")).toBe(false);
    expect(isHighRisk("INTEGRATED")).toBe(false);
    expect(isHighRisk("FUNDED")).toBe(false);
  });

  it("returns false for low-risk relationship types", () => {
    expect(isHighRisk("RELEASED")).toBe(false);
    expect(isHighRisk("ANNOUNCED")).toBe(false);
    expect(isHighRisk("PUBLISHED")).toBe(false);
  });
});

// ============================================================================
// LOW RISK VALIDATION TESTS
// ============================================================================

describe("validateRelationship - LOW risk", () => {
  const lowRiskTypes: RelationType[] = ["RELEASED", "ANNOUNCED", "PUBLISHED"];

  describe.each(lowRiskTypes)("type: %s", (type) => {
    it("approves with single LOW trust source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 1);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Low-risk");
    });

    it("approves with single STANDARD trust source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 1);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Low-risk");
    });

    it("approves with single AUTHORITATIVE source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Low-risk");
    });

    it("approves regardless of source count", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 5);
      expect(result.status).toBe("APPROVED");
    });
  });
});

// ============================================================================
// MEDIUM RISK VALIDATION TESTS
// ============================================================================

describe("validateRelationship - MEDIUM risk", () => {
  const mediumRiskTypes: RelationType[] = ["PARTNERED", "INTEGRATED", "FUNDED"];

  describe.each(mediumRiskTypes)("type: %s", (type) => {
    it("approves with AUTHORITATIVE source (single)", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Authoritative");
    });

    it("approves with 2+ STANDARD sources", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 2);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Multiple sources");
    });

    it("approves with 2+ LOW sources", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 2);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Multiple sources");
    });

    it("quarantines with single STANDARD source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 1);
      expect(result.status).toBe("QUARANTINED");
      expect(result.reason).toContain("Medium-risk");
      expect(result.reason).toContain("2+ sources");
    });

    it("quarantines with single LOW source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 1);
      expect(result.status).toBe("QUARANTINED");
      expect(result.reason).toContain("Medium-risk");
    });

    it("approves with 3+ sources (overkill but valid)", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 3);
      expect(result.status).toBe("APPROVED");
    });
  });
});

// ============================================================================
// HIGH RISK VALIDATION TESTS
// ============================================================================

describe("validateRelationship - HIGH risk", () => {
  const highRiskTypes: RelationType[] = [
    "ACQUIRED",
    "BANNED",
    "BEATS",
    "CRITICIZED",
  ];

  describe.each(highRiskTypes)("type: %s", (type) => {
    it("approves with AUTHORITATIVE source (single)", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Authoritative");
      expect(result.reason).toContain("high-risk");
    });

    it("approves with 2+ STANDARD sources", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 2);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Multiple sources");
      expect(result.reason).toContain("high-risk");
    });

    it("approves with 2+ LOW sources", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 2);
      expect(result.status).toBe("APPROVED");
      expect(result.reason).toContain("Multiple sources");
    });

    it("quarantines with single STANDARD source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "STANDARD", 1);
      expect(result.status).toBe("QUARANTINED");
      expect(result.reason).toContain("High-risk");
      expect(result.reason).toContain("authoritative");
    });

    it("quarantines with single LOW source", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 1);
      expect(result.status).toBe("QUARANTINED");
      expect(result.reason).toContain("High-risk");
    });

    it("approves with many sources", () => {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "LOW", 10);
      expect(result.status).toBe("APPROVED");
    });
  });
});

// ============================================================================
// MODEL CONFIDENCE TESTS - CRITICAL: Must NOT influence approval
// ============================================================================

describe("validateRelationship - model confidence is ignored", () => {
  it("approves LOW risk with 0% model confidence", () => {
    const proposal = createProposal("RELEASED", { modelConfidence: 0 });
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(result.status).toBe("APPROVED");
  });

  it("approves LOW risk with 100% model confidence", () => {
    const proposal = createProposal("RELEASED", { modelConfidence: 1.0 });
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(result.status).toBe("APPROVED");
  });

  it("still quarantines MEDIUM risk with 100% confidence but single LOW source", () => {
    const proposal = createProposal("PARTNERED", { modelConfidence: 1.0 });
    const result = validateRelationship(proposal, "LOW", 1);
    expect(result.status).toBe("QUARANTINED");
  });

  it("still quarantines HIGH risk with 100% confidence but single STANDARD source", () => {
    const proposal = createProposal("ACQUIRED", { modelConfidence: 1.0 });
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(result.status).toBe("QUARANTINED");
  });

  it("still approves with 0% confidence if sources meet criteria", () => {
    const proposal = createProposal("ACQUIRED", { modelConfidence: 0 });
    const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
    expect(result.status).toBe("APPROVED");
  });

  it("confidence value does not affect outcome - parameterized test", () => {
    const confidences = [0, 0.1, 0.5, 0.7, 0.9, 0.99, 1.0];

    for (const confidence of confidences) {
      // HIGH risk + single LOW source = always QUARANTINED
      const proposalHigh = createProposal("BANNED", {
        modelConfidence: confidence,
      });
      const resultHigh = validateRelationship(proposalHigh, "LOW", 1);
      expect(resultHigh.status).toBe("QUARANTINED");

      // LOW risk + any source = always APPROVED
      const proposalLow = createProposal("PUBLISHED", {
        modelConfidence: confidence,
      });
      const resultLow = validateRelationship(proposalLow, "LOW", 1);
      expect(resultLow.status).toBe("APPROVED");
    }
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("validateRelationship - edge cases", () => {
  it("handles exactly 2 sources for medium risk (boundary)", () => {
    const proposal = createProposal("FUNDED");
    const result = validateRelationship(proposal, "STANDARD", 2);
    expect(result.status).toBe("APPROVED");
  });

  it("handles exactly 1 source for medium risk (boundary)", () => {
    const proposal = createProposal("FUNDED");
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(result.status).toBe("QUARANTINED");
  });

  it("handles zero sources (edge case)", () => {
    const proposal = createProposal("RELEASED");
    const result = validateRelationship(proposal, "STANDARD", 0);
    // Low risk should still approve since single source is OK
    // and this is a degenerate case
    expect(result.status).toBe("APPROVED");
  });

  it("handles negative source count gracefully", () => {
    const proposal = createProposal("ACQUIRED");
    const result = validateRelationship(proposal, "STANDARD", -1);
    // Should not approve with negative count
    expect(result.status).toBe("QUARANTINED");
  });

  it("preserves all proposal fields in validation", () => {
    const proposal: RelationshipProposal = {
      sourceEntity: "openai",
      targetEntity: "anthropic",
      type: "PARTNERED",
      eventId: "evt-123",
      modelConfidence: 0.85,
    };
    const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
    // Result should be based on proposal.type, not other fields
    expect(result.status).toBe("APPROVED");
  });
});

// ============================================================================
// AUDIT TRAIL - reason field tests
// ============================================================================

describe("validateRelationship - audit trail reasons", () => {
  it("includes relevant info in approval reason for low risk", () => {
    const proposal = createProposal("RELEASED");
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(result.reason).toBeTruthy();
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("includes relevant info in approval reason for authoritative source", () => {
    const proposal = createProposal("ACQUIRED");
    const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
    expect(result.reason.toLowerCase()).toContain("authoritative");
  });

  it("includes relevant info in approval reason for multiple sources", () => {
    const proposal = createProposal("BANNED");
    const result = validateRelationship(proposal, "STANDARD", 3);
    expect(result.reason.toLowerCase()).toContain("multiple");
  });

  it("includes relevant info in quarantine reason", () => {
    const proposal = createProposal("CRITICIZED");
    const result = validateRelationship(proposal, "LOW", 1);
    expect(result.reason).toBeTruthy();
    expect(result.reason.toLowerCase()).toContain("high-risk");
  });
});

// ============================================================================
// TYPE SAFETY TESTS
// ============================================================================

describe("type safety", () => {
  it("SafetyResult status is one of the expected values", () => {
    const proposal = createProposal("RELEASED");
    const result = validateRelationship(proposal, "STANDARD", 1);
    expect(["PENDING", "APPROVED", "QUARANTINED", "REJECTED"]).toContain(
      result.status
    );
  });

  it("TrustTier values work correctly", () => {
    const trustTiers: TrustTier[] = ["AUTHORITATIVE", "STANDARD", "LOW"];
    const proposal = createProposal("RELEASED");

    for (const tier of trustTiers) {
      const result = validateRelationship(proposal, tier, 1);
      expect(result.status).toBe("APPROVED");
    }
  });

  it("all RelationType values are handled", () => {
    const allTypes: RelationType[] = [
      "RELEASED",
      "ANNOUNCED",
      "PUBLISHED",
      "PARTNERED",
      "INTEGRATED",
      "FUNDED",
      "ACQUIRED",
      "BANNED",
      "BEATS",
      "CRITICIZED",
    ];

    for (const type of allTypes) {
      const proposal = createProposal(type);
      const result = validateRelationship(proposal, "AUTHORITATIVE", 1);
      // All types should be handled (no REJECTED for unknown)
      expect(result.status).not.toBe("REJECTED");
    }
  });
});
