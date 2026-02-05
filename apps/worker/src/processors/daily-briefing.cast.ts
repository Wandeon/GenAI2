// ============================================================================
// CAST MODULE - Per-turn LLM generation for Council Roundtable
// ============================================================================
// Each persona turn = separate LLM call fed conversation history.
// Creates authentic back-and-forth where each persona responds to prior turns.

import type { LLMClient, LLMUsage, ChatMessage } from "@genai/llm";
import type { RoundtableTurn } from "@genai/shared/schemas/daily-briefing";

import type { EventForBriefing } from "./daily-briefing.types";
import type { TurnPlan } from "./daily-briefing.director";
import { planEpisode } from "./daily-briefing.director";
import { log } from "./daily-briefing.utils";

// ============================================================================
// Persona System Prompts
// ============================================================================

const PERSONA_PROMPTS: Record<string, string> = {
  GM: `You are GM, the host of Council Roundtable — a daily AI news show for Croatian tech audience.
Voice: Sharp, slightly irreverent, keeps tempo. You say "mi" (we) not "ja" (I).
You introduce topics with energy, call out what matters, and cut through noise.
You're not neutral — you have opinions, but you back them up.
Think: tech podcast host who actually understands the code.`,

  Engineer: `You are the Engineer on Council Roundtable.
Voice: Technical, precise, no-bullshit. You care about what's actually real.
When someone announces a "breakthrough", you check the benchmarks, the params, the methodology.
You cite specific numbers: model sizes, scores, dates, version numbers.
You respect good engineering and call out vaporware.
Think: senior ML engineer who's tired of hype but genuinely excited by real progress.`,

  Skeptic: `You are the Skeptic on Council Roundtable.
Voice: Sharp, probing, slightly adversarial. You're the audience's defense attorney.
You ask "who benefits?", "what's the business model?", "where's the second source?"
You don't hate progress — you hate weak evidence dressed up as certainty.
When claims are strong, you acknowledge it. When they're weak, you tear them apart.
Think: investigative journalist who covers tech.`,
};

// ============================================================================
// Types
// ============================================================================

interface GenerateTurnParams {
  client: LLMClient;
  turnPlan: TurnPlan;
  eventsText: string;
  conversationSoFar: RoundtableTurn[];
  turnIndex: number;
}

interface CastTurnResult {
  turn: RoundtableTurn;
  usage: LLMUsage;
}

export interface GenerateEpisodeParams {
  client: LLMClient;
  events: EventForBriefing[];
  eventsText: string;
  date: string;
}

export interface EpisodeResult {
  roundtable: RoundtableTurn[];
  totalUsage: LLMUsage;
  turnCount: number;
}

// ============================================================================
// Turn Generation
// ============================================================================

function formatConversationHistory(turns: RoundtableTurn[]): string {
  if (turns.length === 0) return "No conversation yet — you're opening the show.";
  return turns
    .map((t) => {
      const label = t.moveType === "CUT" ? "---" : `[${t.persona} / ${t.moveType}]`;
      return `${label}: ${t.text}`;
    })
    .join("\n");
}

/**
 * Generate a single turn via LLM chat call.
 * Returns the parsed turn and token usage.
 */
export async function generateTurn(params: GenerateTurnParams): Promise<CastTurnResult> {
  const { client, turnPlan, eventsText, conversationSoFar, turnIndex } = params;

  // CUT turns are synthetic — no LLM call needed
  if (turnPlan.moveType === "CUT") {
    return {
      turn: {
        persona: "GM",
        moveType: "CUT",
        text: "---",
        textHr: "---",
      },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  const systemPrompt = PERSONA_PROMPTS[turnPlan.persona] ?? "You are a panelist on Council Roundtable, a daily AI news show.";
  const history = formatConversationHistory(conversationSoFar);

  const userPrompt = `TODAY'S EVENTS:
${eventsText}

CONVERSATION SO FAR:
${history}

YOUR TASK (Turn ${turnIndex + 1}, ${turnPlan.moveType}):
${turnPlan.instruction}

${turnPlan.eventRefs.length > 0 ? `Reference event(s): #${turnPlan.eventRefs.join(", #")}` : ""}

Respond with ONLY a JSON object:
{
  "text": "Your line in English. Max 2 sentences. Be concrete: names, numbers, versions.",
  "textHr": "Ista linija na hrvatskom. Maks 18 riječi po rečenici. Koristi 'u' ne 'v'."${turnPlan.eventRefs.length > 0 ? `,\n  "eventRef": ${turnPlan.eventRefs[0]}` : ""}
}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  if (!client.chat) {
    throw new Error("LLM client does not support chat() method");
  }

  const response = await client.chat(messages, { temperature: 0.7 });
  const parsed = parseTurnResponse(response.content);

  const turn: RoundtableTurn = {
    persona: turnPlan.persona,
    moveType: turnPlan.moveType,
    text: parsed.text,
    textHr: parsed.textHr,
    ...(parsed.eventRef !== undefined ? { eventRef: parsed.eventRef } : {}),
  };

  return { turn, usage: response.usage };
}

// ============================================================================
// Response Parsing
// ============================================================================

interface ParsedTurnResponse {
  text: string;
  textHr: string;
  eventRef?: number;
}

function parseTurnResponse(content: string): ParsedTurnResponse {
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

  const parsed = JSON.parse(jsonStr.trim()) as Record<string, unknown>;

  if (typeof parsed.text !== "string" || typeof parsed.textHr !== "string") {
    throw new Error("Turn response missing text or textHr");
  }

  return {
    text: parsed.text,
    textHr: parsed.textHr,
    eventRef: typeof parsed.eventRef === "number" ? parsed.eventRef : undefined,
  };
}

// ============================================================================
// Episode Generation
// ============================================================================

const MIN_SUCCESSFUL_TURNS = 4;

/**
 * Generate a full episode: plan via Director, then generate each turn sequentially.
 * Each turn sees all prior turns as conversation history.
 */
export async function generateEpisode(params: GenerateEpisodeParams): Promise<EpisodeResult> {
  const { client, events, eventsText, date } = params;
  void date;

  const plan = planEpisode(events);

  if (plan.turns.length === 0) {
    throw new Error("Director produced empty plan — no events to discuss");
  }

  const roundtable: RoundtableTurn[] = [];
  const totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  for (let i = 0; i < plan.turns.length; i++) {
    const turnPlan = plan.turns[i];
    if (!turnPlan) continue;

    try {
      const result = await generateTurn({
        client,
        turnPlan,
        eventsText,
        conversationSoFar: roundtable,
        turnIndex: i,
      });

      roundtable.push(result.turn);
      totalUsage.inputTokens += result.usage.inputTokens;
      totalUsage.outputTokens += result.usage.outputTokens;
      totalUsage.totalTokens += result.usage.totalTokens;
    } catch (error) {
      log(`Turn ${i} (${turnPlan.persona}/${turnPlan.moveType}) failed: ${error}`);
      // Skip failed turns, continue with episode
    }
  }

  if (roundtable.length < MIN_SUCCESSFUL_TURNS) {
    throw new Error(
      `Only ${roundtable.length} turns succeeded (minimum ${MIN_SUCCESSFUL_TURNS}). Episode generation failed.`
    );
  }

  log(`Cast generated ${roundtable.length}/${plan.turns.length} turns`);

  return {
    roundtable,
    totalUsage,
    turnCount: roundtable.length,
  };
}
