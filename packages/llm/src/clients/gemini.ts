import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";
import type { LLMClient, LLMResponse } from "../gm/service";

// ============================================================================
// GEMINI CLIENT - Google AI implementation of LLM interface
// ============================================================================
// Implements Architecture Constitution #9: Observability built-in
// Every call tracks tokens for cost calculation

// Gemini 2.0 Flash pricing (per 1M tokens)
const GEMINI_FLASH_PRICING = {
  inputPerMillion: 0.075, // $0.075 per 1M input tokens
  outputPerMillion: 0.3, // $0.30 per 1M output tokens
};

/**
 * Calculate cost in cents for Gemini usage.
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in cents (integer)
 */
export function calculateGeminiCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost =
    (inputTokens / 1_000_000) * GEMINI_FLASH_PRICING.inputPerMillion;
  const outputCost =
    (outputTokens / 1_000_000) * GEMINI_FLASH_PRICING.outputPerMillion;
  // Convert to cents and round up to ensure we never underestimate
  return Math.ceil((inputCost + outputCost) * 100);
}

/**
 * Generate SHA-256 hash for a string (used for prompt/input hashing).
 *
 * @param input - String to hash
 * @returns First 32 characters of hex hash
 */
export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/**
 * Create a Gemini LLM client.
 *
 * @param apiKey - Google AI API key
 * @param model - Model to use (default: gemini-2.0-flash)
 * @returns LLMClient implementation
 */
export function createGeminiClient(
  apiKey: string,
  model = "gemini-2.0-flash"
): LLMClient {
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({ model });

  return {
    provider: "google",
    model,

    async complete(prompt: string): Promise<LLMResponse> {
      const result = await generativeModel.generateContent(prompt);
      const response = result.response;

      // Extract usage metadata
      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = usageMetadata?.totalTokenCount ?? inputTokens + outputTokens;

      // Extract text content
      const content = response.text();

      return {
        content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
        },
      };
    },
  };
}
