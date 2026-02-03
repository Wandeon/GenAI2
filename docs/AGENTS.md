# AI Agents & LLM Configuration

## Overview

GenAI Observatory uses multiple LLM providers optimized for different task types.

## Provider Configuration

### Embeddings - Ollama Local

**Purpose:** Vector embeddings for search and similarity

```yaml
provider: ollama-local
endpoint: http://localhost:11434
model: nomic-embed-text
dimensions: 768
```

**Used for:**
- Event similarity detection
- Entity deduplication
- Semantic search
- Topic clustering

### Easy Tasks - Gemini 3 Flash Preview

**Purpose:** Fast, cheap tasks that don't require deep reasoning

```yaml
provider: google
model: gemini-3-flash-preview
temperature: 0.3
max_tokens: 2048
```

**Used for:**
- Headline generation (HEADLINE artifact)
- Topic assignment (TOPIC_ASSIGN artifact)
- Simple entity extraction
- Translation (EN → HR)

### Hard Tasks - Gemini 3 Pro Preview + DeepSeek Fallback

**Purpose:** Complex reasoning, analysis, multi-step tasks

```yaml
provider: google
model: gemini-3-pro-preview
fallback:
  provider: deepseek
  model: deepseek-chat
temperature: 0.5
max_tokens: 4096
```

**Used for:**
- GM Take generation (GM_TAKE artifact)
- Why It Matters analysis (WHY_MATTERS artifact)
- Relationship extraction with confidence
- Daily briefing synthesis
- Complex entity resolution

### Cloud LLM Runs - Ollama Cloud

**Purpose:** Scalable inference for batch processing

```yaml
provider: ollama-cloud
models:
  - mixtral:8x7b
  - llama3:70b
```

**Used for:**
- Batch processing during off-peak
- Fallback when Google quota exceeded
- A/B testing model outputs

## GM (Game Master) Service

The GM is the editorial voice of GenAI Observatory.

### Identity Contract

```typescript
{
  version: "1.0.0",
  name: "GM",
  role: "AI News Curator & Analyst for Croatian audience",

  tone: {
    allowed: ["informative", "curious", "slightly irreverent", "honest about uncertainty"],
    forbidden: ["sensationalist", "clickbait", "fake certainty", "invented quotes"]
  },

  neverDo: [
    "Invent quotes or statistics",
    "Claim certainty when evidence is weak",
    "Make predictions without marking as speculation",
    "Use corporate-speak (revolutionary, game-changing)"
  ]
}
```

### Output Schemas

All GM outputs are validated against Zod schemas in `packages/shared/src/schemas/artifacts.ts`:

| Artifact Type | Schema | Model |
|---------------|--------|-------|
| HEADLINE | HeadlinePayload | Flash |
| SUMMARY | SummaryPayload | Flash |
| GM_TAKE | GMTakePayload | Pro |
| WHY_MATTERS | WhyMattersPayload | Pro |
| ENTITY_EXTRACT | EntityExtractPayload | Flash |
| TOPIC_ASSIGN | TopicAssignPayload | Flash |

## LLM Observability

Every LLM call is logged to the `LLMRun` table:

```prisma
model LLMRun {
  id            String   @id
  provider      String   // "google", "ollama", "deepseek"
  model         String   // "gemini-2.0-flash"
  inputTokens   Int
  outputTokens  Int
  costCents     Int      // Cost in USD cents
  latencyMs     Int
  promptHash    String   // For replay capability
  inputHash     String
  processorName String
  eventId       String?
}
```

## Cost Management

| Model | Input (per 1M) | Output (per 1M) | Budget |
|-------|----------------|-----------------|--------|
| gemini-3-flash-preview | $0.075 | $0.30 | Primary |
| gemini-3-pro-preview | $1.25 | $5.00 | Gated |
| deepseek-chat | $0.14 | $0.28 | Fallback |
| ollama-local | $0 | $0 | Unlimited |

**Target:** < $0.02 per event

## Fallback Strategy

```
1. Try primary model (Gemini Flash/Pro)
   ↓ on failure
2. Try DeepSeek fallback
   ↓ on failure
3. Try Ollama Cloud
   ↓ on failure
4. Queue for retry with exponential backoff
```

## Environment Variables

```bash
# Google AI
GOOGLE_AI_API_KEY=

# DeepSeek
DEEPSEEK_API_KEY=

# Ollama Local
OLLAMA_LOCAL_URL=http://localhost:11434

# Ollama Cloud
OLLAMA_CLOUD_URL=
OLLAMA_CLOUD_API_KEY=
```

---

## Hard Rules

- GM_TAKE and WHY_MATTERS MUST use a Hard Tasks model.
- HEADLINE, SUMMARY, ENTITY_EXTRACT, TOPIC_ASSIGN MUST NOT use Hard Tasks models.
- No processor may call an LLM directly.
  All calls MUST go through GMService or LLMService wrapper.
- All calls MUST write an LLMRun record.
- If LLMRun logging fails → the processor must fail.

---

## Temperature Policy

- Flash models: temperature <= 0.3  
- Pro models: temperature <= 0.5  
- Embeddings: temperature = 0  

Any deviation requires justification in DECISIONS.md.

---

## Token Budgets

| Artifact | Max Input Tokens | Max Output Tokens |
|----------|------------------|-------------------|
| HEADLINE | 1,000 | 200 |
| SUMMARY | 2,000 | 500 |
| GM_TAKE | 3,000 | 1,000 |
| WHY_MATTERS | 3,000 | 1,000 |
| ENTITY_EXTRACT | 2,000 | 800 |
| TOPIC_ASSIGN | 1,000 | 300 |

If exceeded → abort and log error.

---

## Cost Circuit Breaker

System-wide limits:

- Max cost per event: $0.02  
- Max daily cost: configurable via ENV  

If exceeded:

1. Stop GM enrichment  
2. Continue ingest + evidence only  
3. Raise alert  

---

## Model Version Pinning

Models must be referenced with explicit version IDs where supported.

Upgrades require:
- A/B test
- Output diff
- DECISIONS.md update

---

## Embedding Consistency

Embedding model and dimensions are immutable once production starts.

Changing embedding model requires:
- Full re-embedding
- Dual-index period
- Migration plan

---

## Prompt & Input Cache

- Store prompt text and input payload for 30 days  
- After 30 days keep only hashes  
- Enables replay while limiting storage growth
