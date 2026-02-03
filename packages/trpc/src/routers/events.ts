import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const ImpactLevel = z.enum(["BREAKING", "HIGH", "MEDIUM", "LOW"]);

const mockEvents = [
  {
    id: "1",
    title: "OpenAI announces GPT-5 with reasoning capabilities",
    titleHr: "OpenAI najavljuje GPT-5 s mogućnostima rasuđivanja",
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    impactLevel: "BREAKING" as const,
    sourceCount: 12,
    topics: ["OpenAI", "LLM", "GPT"],
    summaryHr: "OpenAI je danas najavio GPT-5.",
    status: "PUBLISHED",
  },
  {
    id: "2",
    title: "Anthropic raises $2B Series C",
    titleHr: "Anthropic prikupio 2 milijarde dolara",
    occurredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    impactLevel: "HIGH" as const,
    sourceCount: 8,
    topics: ["Anthropic", "Financiranje"],
    status: "PUBLISHED",
  },
  {
    id: "3",
    title: "New scaling laws paper published",
    titleHr: "Objavljen novi rad o zakonima skaliranja",
    occurredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    impactLevel: "MEDIUM" as const,
    sourceCount: 3,
    topics: ["Istraživanje"],
    status: "PUBLISHED",
  },
  {
    id: "4",
    title: "Minor update to PyTorch documentation",
    titleHr: "Manja nadogradnja PyTorch dokumentacije",
    occurredAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    impactLevel: "LOW" as const,
    sourceCount: 1,
    topics: ["PyTorch", "Dokumentacija"],
    status: "PUBLISHED",
  },
];

export const eventsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        status: z.string().optional(),
        impactLevel: ImpactLevel.optional(),
        beforeTime: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      let items = [...mockEvents];

      if (input.beforeTime) {
        items = items.filter(
          (e) => e.occurredAt.getTime() <= input.beforeTime!.getTime()
        );
      }

      if (input.impactLevel) {
        items = items.filter((e) => e.impactLevel === input.impactLevel);
      }

      if (input.status) {
        items = items.filter((e) => e.status === input.status);
      }

      items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      items = items.slice(0, input.limit);

      return {
        items,
        nextCursor: null as string | null,
      };
    }),

  byId: publicProcedure.input(z.string()).query(async ({ input }) => {
    return mockEvents.find((e) => e.id === input) ?? null;
  }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const q = input.query.toLowerCase();
      return mockEvents
        .filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.titleHr?.toLowerCase().includes(q) ||
            e.topics.some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, input.limit);
    }),
});
