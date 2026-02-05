import { GM_CONTRACT } from "./contract";
import type { ArtifactType, ArtifactPayloadMap } from "@genai/shared/schemas/artifacts";

// ============================================================================
// GM SERVICE - Versioned LLM service with contract enforcement
// ============================================================================

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
}

export interface LLMRun {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costCents: number;
  latencyMs: number;
  promptHash: string;
  inputHash: string;
  processorName: string;
  eventId?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMClient {
  provider: string;
  model: string;
  complete(prompt: string): Promise<LLMResponse>;
  chat?(messages: ChatMessage[], options?: { temperature?: number }): Promise<LLMResponse>;
}

/**
 * GM Service - Generates artifacts with contract enforcement
 *
 * Key principles:
 * - All outputs validated against Zod schemas
 * - Every call logged with tokens, cost, latency
 * - Prompt and input hashes stored for replay capability
 */
export class GMService {
  constructor(
    private llm: LLMClient,
    private contract: typeof GM_CONTRACT = GM_CONTRACT
  ) {
    void this.llm;
  }

  /**
   * Generate an artifact for an event
   * Returns typed payload + LLM run metadata
   */
  async generateArtifact<T extends ArtifactType>(
    _eventId: string,
    _type: T,
    _input: unknown
  ): Promise<{ payload: ArtifactPayloadMap[T]; run: Omit<LLMRun, "id"> }> {
    // TODO: Implement in Phase 2
    // 1. Build prompt from contract + type + input
    // 2. Call LLM
    // 3. Parse and validate response against schema
    // 4. Log run with tokens, cost, latency
    // 5. Return typed payload + run metadata
    throw new Error("Not implemented - Phase 2");
  }

  /**
   * Get the current contract version
   */
  getContractVersion(): string {
    return this.contract.version;
  }
}
