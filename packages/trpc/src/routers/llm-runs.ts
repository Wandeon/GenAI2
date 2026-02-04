// packages/trpc/src/routers/llm-runs.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const llmRunsRouter = router({
  // Get LLM runs for a specific event
  byEventId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const runs = await ctx.db.lLMRun.findMany({
      where: { eventId: input },
      orderBy: { createdAt: "asc" },
    });

    return runs.map((run) => ({
      id: run.id,
      provider: run.provider,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      totalTokens: run.totalTokens,
      costCents: run.costCents,
      latencyMs: run.latencyMs,
      processorName: run.processorName,
      createdAt: run.createdAt,
    }));
  }),

  // Daily cost summary for dashboard
  dailyCost: publicProcedure
    .input(
      z.object({
        days: z.number().min(1).max(30).default(7),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const runs = await ctx.db.lLMRun.groupBy({
        by: ["processorName"],
        where: {
          createdAt: { gte: since },
        },
        _sum: {
          costCents: true,
          totalTokens: true,
        },
        _count: true,
      });

      const totalCostCents = runs.reduce(
        (sum, r) => sum + (r._sum.costCents || 0),
        0
      );

      return {
        totalCostCents,
        totalCostDollars: totalCostCents / 100,
        byProcessor: runs.map((r) => ({
          processor: r.processorName,
          costCents: r._sum.costCents || 0,
          tokens: r._sum.totalTokens || 0,
          calls: r._count,
        })),
      };
    }),

  // Get recent LLM runs (for monitoring)
  recent: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const runs = await ctx.db.lLMRun.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });

      return runs.map((run) => ({
        id: run.id,
        provider: run.provider,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        costCents: run.costCents,
        latencyMs: run.latencyMs,
        processorName: run.processorName,
        eventId: run.eventId,
        createdAt: run.createdAt,
      }));
    }),
});
