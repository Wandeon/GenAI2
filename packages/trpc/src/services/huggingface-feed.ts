import type { NormalizedEvent } from "@genai/shared";

// ============================================================================
// HuggingFace Feed - Fetches trending AI models from HuggingFace Hub
// ============================================================================
// Uses public API (no auth required)

const HF_API = "https://huggingface.co/api/models";
const AI_PIPELINES = [
  "text-generation", "text2text-generation", "text-classification",
  "question-answering", "summarization", "conversational",
  "image-classification", "object-detection", "image-to-text",
  "text-to-image", "automatic-speech-recognition",
];

interface HFModel {
  id: string;
  author: string;
  lastModified: string;
  downloads: number;
  likes: number;
  pipeline_tag?: string;
}

function log(msg: string) {
  process.env.NODE_ENV !== "test" && console.log(`[huggingface-feed] ${msg}`);
}

export async function fetchHuggingFaceModels(): Promise<NormalizedEvent[]> {
  try {
    const url = `${HF_API}?sort=lastModified&direction=-1&limit=50`;

    const res = await fetch(url);
    if (!res.ok) {
      log(`HuggingFace API returned ${res.status}`);
      return [];
    }

    const models: HFModel[] = await res.json();

    // Filter for AI pipeline tags
    const aiModels = models.filter(
      (m) => m.pipeline_tag && AI_PIPELINES.includes(m.pipeline_tag)
    );

    log(`Fetched ${models.length} models, ${aiModels.length} AI-related`);

    return aiModels.map((m) => {
      const name = m.id.includes("/") ? m.id.split("/")[1] : m.id;
      return {
        id: `hf-${m.id.replace(/\//g, "-")}`,
        sourceType: "HUGGINGFACE" as const,
        externalId: m.id,
        url: `https://huggingface.co/${m.id}`,
        title: `${name} by ${m.author} (${m.pipeline_tag})`,
        occurredAt: new Date(m.lastModified),
        impactLevel:
          m.likes > 100 ? "HIGH" : m.likes > 20 ? "MEDIUM" : "LOW",
        sourceCount: 1,
        topics: [m.pipeline_tag || "model"],
      };
    }) as NormalizedEvent[];
  } catch (err) {
    log(`Fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
