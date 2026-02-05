import crypto from "crypto";
import type { ChatMessage, LLMClient, LLMResponse } from "../gm/service";

// ============================================================================
// OPENAI-COMPATIBLE CLIENT - Works with Ollama Cloud, DeepSeek, etc.
// ============================================================================
// Uses the OpenAI chat completions API format.
// Primary: Ollama Cloud (gemini-3-flash-preview / gemini-3-pro-preview)
// Fallback: DeepSeek API (deepseek-v3.2)

interface ChatCompletion {
  choices: Array<{
    message: { content: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Estimate cost in cents for LLM usage.
 * Ollama Cloud pricing varies; this is a conservative estimate.
 */
export function calculateLLMCost(
  inputTokens: number,
  outputTokens: number
): number {
  // Gemini Flash via Ollama: ~$0.075/1M input, ~$0.30/1M output
  const inputCost = (inputTokens / 1_000_000) * 0.075;
  const outputCost = (outputTokens / 1_000_000) * 0.3;
  return Math.ceil((inputCost + outputCost) * 100);
}

/**
 * Generate SHA-256 hash for a string (used for prompt/input hashing).
 */
export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/**
 * Create an OpenAI-compatible LLM client.
 *
 * @param baseUrl - API base URL (e.g. https://ollama.com/v1)
 * @param apiKey - API key
 * @param model - Model name (e.g. gemini-3-flash-preview)
 */
export function createLLMClient(
  baseUrl: string,
  apiKey: string,
  model: string
): LLMClient {
  return {
    provider: baseUrl.includes("ollama") ? "ollama" : baseUrl.includes("deepseek") ? "deepseek" : "openai-compat",
    model,

    async complete(prompt: string): Promise<LLMResponse> {
      const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data: ChatCompletion = await res.json();

      const content = data.choices?.[0]?.message?.content ?? "";
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

      return {
        content,
        usage: { inputTokens, outputTokens, totalTokens },
      };
    },

    async chat(messages: ChatMessage[], options?: { temperature?: number }): Promise<LLMResponse> {
      const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LLM API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data: ChatCompletion = await res.json();

      const content = data.choices?.[0]?.message?.content ?? "";
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

      return {
        content,
        usage: { inputTokens, outputTokens, totalTokens },
      };
    },
  };
}

/**
 * Create the default LLM client from environment variables.
 * Uses OLLAMA_BASE_URL + OLLAMA_API_KEY as primary,
 * falls back to DEEPSEEK_API_KEY if Ollama vars are missing.
 */
export function createDefaultLLMClient(model?: string): LLMClient {
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  const ollamaKey = process.env.OLLAMA_API_KEY;
  const fastModel = process.env.LLM_MODEL_FAST || "gemini-3-flash-preview";

  if (ollamaUrl && ollamaKey) {
    return createLLMClient(ollamaUrl, ollamaKey, model || fastModel);
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const backupModel = process.env.LLM_MODEL_BACKUP || "deepseek-v3.2";

  if (deepseekKey) {
    return createLLMClient(
      "https://api.deepseek.com/v1",
      deepseekKey,
      model || backupModel
    );
  }

  throw new Error(
    "No LLM credentials configured. Set OLLAMA_BASE_URL + OLLAMA_API_KEY or DEEPSEEK_API_KEY"
  );
}
