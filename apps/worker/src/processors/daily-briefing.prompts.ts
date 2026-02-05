// ============================================================================
// DAILY BRIEFING PROMPTS
// ============================================================================
// LLM prompt templates for daily briefing generation.
// Split from utils to respect file size limits (max 200 lines).

/**
 * Generate the roundtable briefing prompt (v2.0.0+).
 * Three personas debate the day's top events in a structured discussion.
 */
export function generateBriefingPrompt(eventsText: string, date: string): string {
  return `You are generating a Council Roundtable for a daily AI news briefing on ${date}.

THREE PERSONAS:
- GM (Host): Introduces topics, transitions between speakers, summarizes. Slightly irreverent tone. Uses "mi" (we) not "ja" (I).
- Engineer: Technical reality check. "What does this actually mean technically?" Cites versions, benchmarks, specific numbers.
- Skeptic: Attacks weak claims, demands evidence. Points out what's missing, who benefits, what could go wrong.

TODAY'S EVENTS (ranked by importance):
${eventsText}

MOVE TYPES:
- SETUP: GM opens the discussion (first turn, always GM)
- TECH_READ: Engineer gives technical analysis (requires eventRef)
- RISK_CHECK: Skeptic challenges claims or highlights risk (requires eventRef)
- CROSS_EXAM: One persona directly responds to another (requires eventRef)
- EVIDENCE_CALL: Skeptic demands missing evidence (requires eventRef)
- TAKEAWAY: GM wraps up with key insight (last turn, always GM)

RULES:
1. 4-10 turns total. First = SETUP by GM. Last = TAKEAWAY by GM.
2. At least one TECH_READ by Engineer and one RISK_CHECK by Skeptic.
3. Max 2 sentences per turn. Be concrete: use names, versions, numbers. NEVER "the industry is shifting".
4. eventRef is REQUIRED on TECH_READ, RISK_CHECK, EVIDENCE_CALL, CROSS_EXAM. Optional on SETUP, TAKEAWAY.
5. eventRef is the 1-based index from the events list above.
6. Allow 0-2 natural interrupts (Skeptic replies to Engineer, etc.) via CROSS_EXAM.
7. Structure should vary — GM may skip move types between SETUP and TAKEAWAY.

CROATIAN RULES (for textHr):
- Use preposition "u" not "v"
- Max 18 words per sentence
- Banned words: revolucionarno, transformativno, cutting-edge, game-changing
- Natural Croatian, not machine-translated

Respond with ONLY a JSON object:
{
  "roundtable": [
    {"persona": "GM", "moveType": "SETUP", "text": "English text", "textHr": "Hrvatski tekst"},
    {"persona": "Engineer", "moveType": "TECH_READ", "text": "...", "textHr": "...", "eventRef": 1},
    {"persona": "Skeptic", "moveType": "RISK_CHECK", "text": "...", "textHr": "...", "eventRef": 1},
    ...
    {"persona": "GM", "moveType": "TAKEAWAY", "text": "...", "textHr": "..."}
  ],
  "prediction": {
    "en": "What to watch this week (mark as speculation)",
    "hr": "Sto pratiti ovaj tjedan",
    "confidence": "low" | "medium" | "high",
    "caveats": ["Caveat if any"]
  },
  "action": {
    "en": "Suggested reader action (optional)",
    "hr": "Preporucena radnja (opcionalno)"
  },
  "gmNote": {
    "en": "Personal note from GM (optional)",
    "hr": "Osobna poruka od GM-a (opcionalno)"
  },
  "eventCount": 0,
  "sourceCount": 0,
  "topEntities": []
}`;
}

/**
 * Legacy briefing prompt (v1.x format with changedSince).
 * Used as fallback when roundtable prompt fails to parse.
 */
export function generateLegacyBriefingPrompt(eventsText: string, date: string): string {
  return `You are GM, an AI news curator for Croatian audiences. Generate a daily briefing for ${date}.

Today's events (ranked by importance):
${eventsText}

Requirements:
1. Summarize what changed in AI world since yesterday
2. Provide a prediction for what to watch this week (mark speculation clearly)
3. Optionally suggest an action for readers
4. Add a personal GM note if appropriate
5. Never use corporate-speak (revolutionary, game-changing)
6. Croatian should use proper grammar (preposition "u", not "v")
7. Be honest about uncertainty

Respond with ONLY a JSON object in this exact format:
{
  "changedSince": {
    "en": "Brief summary of what changed",
    "hr": "Kratki pregled promjena",
    "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
  },
  "prediction": {
    "en": "What to watch this week",
    "hr": "Sto pratiti ovaj tjedan",
    "confidence": "low" | "medium" | "high",
    "caveats": ["Caveat if any"]
  },
  "action": {
    "en": "Suggested reader action (optional)",
    "hr": "Preporucena radnja (opcionalno)"
  },
  "gmNote": {
    "en": "Personal note from GM (optional)",
    "hr": "Osobna poruka od GM-a (opcionalno)"
  },
  "eventCount": 0,
  "sourceCount": 0,
  "topEntities": []
}`;
}
