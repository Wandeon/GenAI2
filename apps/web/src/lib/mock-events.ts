import type { ImpactLevel } from "@/components/event-card";

export interface MockEvent {
  id: string;
  title: string;
  titleHr: string;
  occurredAt: Date;
  impactLevel: ImpactLevel;
  sourceCount: number;
  topics: string[];
  summary?: string;
  summaryHr?: string;
  category: "breaking" | "research" | "industry";
}

const now = new Date();

export const mockEvents: MockEvent[] = [
  {
    id: "1",
    title: "OpenAI announces GPT-5 with reasoning capabilities",
    titleHr: "OpenAI najavljuje GPT-5 s mogućnostima rasuđivanja",
    occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    impactLevel: "BREAKING",
    sourceCount: 12,
    topics: ["OpenAI", "LLM", "GPT"],
    summaryHr: "OpenAI je danas najavio GPT-5, najnapredniji model umjetne inteligencije s poboljšanim mogućnostima rasuđivanja.",
    category: "breaking",
  },
  {
    id: "2",
    title: "Anthropic raises $2B Series C at $20B valuation",
    titleHr: "Anthropic prikupio 2 milijarde dolara u Seriji C",
    occurredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
    impactLevel: "HIGH",
    sourceCount: 8,
    topics: ["Anthropic", "Financiranje"],
    summaryHr: "Anthropic je zatvorio rundu financiranja Serije C od 2 milijarde dolara uz valuaciju od 20 milijardi dolara.",
    category: "breaking",
  },
  {
    id: "3",
    title: "New paper: Scaling Laws for Neural Language Models v2",
    titleHr: "Novi rad: Zakoni skaliranja za neuralne jezične modele v2",
    occurredAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    impactLevel: "MEDIUM",
    sourceCount: 3,
    topics: ["Istraživanje", "Skaliranje"],
    category: "research",
  },
  {
    id: "4",
    title: "Google DeepMind achieves new SOTA on math reasoning",
    titleHr: "Google DeepMind postiže novi SOTA u matematičkom rasuđivanju",
    occurredAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    impactLevel: "HIGH",
    sourceCount: 5,
    topics: ["DeepMind", "Benchmark", "Matematika"],
    category: "research",
  },
  {
    id: "5",
    title: "Meta releases Llama 4 open source",
    titleHr: "Meta objavljuje Llama 4 kao open source",
    occurredAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
    impactLevel: "BREAKING",
    sourceCount: 15,
    topics: ["Meta", "Open Source", "LLM"],
    summaryHr: "Meta je objavila Llama 4, najnoviju verziju svojeg open source LLM-a.",
    category: "industry",
  },
  {
    id: "6",
    title: "Microsoft integrates Copilot into Windows kernel",
    titleHr: "Microsoft integrira Copilot u jezgru Windowsa",
    occurredAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
    impactLevel: "MEDIUM",
    sourceCount: 6,
    topics: ["Microsoft", "Copilot", "Windows"],
    category: "industry",
  },
  {
    id: "7",
    title: "NVIDIA announces next-gen AI chips for 2026",
    titleHr: "NVIDIA najavljuje novu generaciju AI čipova za 2026.",
    occurredAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    impactLevel: "HIGH",
    sourceCount: 9,
    topics: ["NVIDIA", "Hardver"],
    category: "industry",
  },
  {
    id: "8",
    title: "New benchmark: HumanEval 2.0 released",
    titleHr: "Novi benchmark: HumanEval 2.0 objavljen",
    occurredAt: new Date(now.getTime() - 36 * 60 * 60 * 1000),
    impactLevel: "MEDIUM",
    sourceCount: 4,
    topics: ["Benchmark", "Evaluacija"],
    category: "research",
  },
];

export function filterEventsByTime(events: MockEvent[], scrubberValue: number): MockEvent[] {
  const now = Date.now();
  const rangeMs = 7 * 24 * 60 * 60 * 1000;
  const targetTime = now - rangeMs * (1 - scrubberValue / 100);
  return events.filter((event) => event.occurredAt.getTime() <= targetTime);
}

export function filterEventsByCategory(events: MockEvent[], category: MockEvent["category"]): MockEvent[] {
  return events.filter((event) => event.category === category);
}
