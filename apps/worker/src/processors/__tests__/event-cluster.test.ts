import { describe, it, expect } from "vitest";
import { titleSimilarity } from "../event-cluster";

describe("titleSimilarity", () => {
  it("returns 1.0 for identical titles", () => {
    expect(titleSimilarity("OpenAI releases GPT-5", "OpenAI releases GPT-5")).toBe(1.0);
  });

  it("returns high score for similar titles", () => {
    const score = titleSimilarity(
      "OpenAI releases GPT-5 with improved reasoning",
      "OpenAI launches GPT-5 featuring better reasoning"
    );
    expect(score).toBeGreaterThan(0.3);
  });

  it("returns low score for unrelated titles", () => {
    const score = titleSimilarity(
      "OpenAI announces GPT-5",
      "Nvidia stock hits record high"
    );
    expect(score).toBeLessThan(0.15);
  });

  it("returns 0 for empty strings", () => {
    expect(titleSimilarity("", "something")).toBe(0);
    expect(titleSimilarity("something", "")).toBe(0);
  });

  it("is case insensitive", () => {
    expect(titleSimilarity("OpenAI GPT", "openai gpt")).toBe(1.0);
  });
});
