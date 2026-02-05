export {
  createLLMClient,
  createDefaultLLMClient,
  calculateLLMCost,
  hashString,
} from "./openai-compat";

// Backward-compat aliases used by processors
export { calculateLLMCost as calculateGeminiCost } from "./openai-compat";
export { createDefaultLLMClient as createGeminiClient } from "./openai-compat";
