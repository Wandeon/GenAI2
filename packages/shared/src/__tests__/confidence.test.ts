import { describe, it, expect } from "vitest";
import { computeConfidence, confidenceToStatus } from "../confidence";
import type { EvidenceTrustProfile } from "../confidence";

describe("computeConfidence", () => {
  it("returns HIGH for 1 AUTHORITATIVE source", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 1, tiers: ["AUTHORITATIVE"] };
    expect(computeConfidence(profile)).toBe("HIGH");
  });

  it("returns HIGH for 3+ sources with at least 1 STANDARD", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 3, tiers: ["STANDARD", "LOW", "LOW"] };
    expect(computeConfidence(profile)).toBe("HIGH");
  });

  it("returns MEDIUM for 2 sources with 1 STANDARD", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 2, tiers: ["STANDARD", "LOW"] };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns MEDIUM for 2 LOW-only sources", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 2, tiers: ["LOW", "LOW"] };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns MEDIUM for 1 STANDARD source", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 1, tiers: ["STANDARD"] };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });

  it("returns LOW for 1 LOW source", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 1, tiers: ["LOW"] };
    expect(computeConfidence(profile)).toBe("LOW");
  });

  it("returns LOW for 0 sources", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 0, tiers: [] };
    expect(computeConfidence(profile)).toBe("LOW");
  });

  it("returns MEDIUM for 3 LOW sources (no STANDARD)", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 3, tiers: ["LOW", "LOW", "LOW"] };
    expect(computeConfidence(profile)).toBe("MEDIUM");
  });
});

describe("end-to-end: confidence + status gate", () => {
  it("single AUTHORITATIVE source publishes (not quarantined)", () => {
    const profile: EvidenceTrustProfile = { sourceCount: 1, tiers: ["AUTHORITATIVE"] };
    const confidence = computeConfidence(profile);
    expect(confidence).toBe("HIGH");
    expect(confidenceToStatus(confidence)).toBe("PUBLISHED");
  });
});

describe("confidenceToStatus", () => {
  it("maps HIGH → PUBLISHED", () => {
    expect(confidenceToStatus("HIGH")).toBe("PUBLISHED");
  });

  it("maps MEDIUM → PUBLISHED", () => {
    expect(confidenceToStatus("MEDIUM")).toBe("PUBLISHED");
  });

  it("maps LOW → QUARANTINED", () => {
    expect(confidenceToStatus("LOW")).toBe("QUARANTINED");
  });
});
