// packages/trpc/src/routers/sessions.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";

/**
 * Sessions Router
 *
 * Manages anonymous sessions and catch-up tracking.
 * Implements Architecture Constitution #5: Server-side identity with HttpOnly cookie
 */
export const sessionsRouter = router({
  /**
   * Get current session with watchlists
   */
  get: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionId) {
      return null;
    }

    const session = await ctx.db.anonSession.findUnique({
      where: { id: ctx.sessionId },
      include: {
        watchlists: {
          include: {
            entities: true,
            topics: true,
          },
        },
      },
    });

    return session;
  }),

  /**
   * Update cursor to track last seen event
   * Called when user views/scrolls through events
   */
  updateCursor: publicProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session",
        });
      }

      await ctx.db.anonSession.update({
        where: { id: ctx.sessionId },
        data: {
          lastEventCursor: input.eventId,
          lastSeenAt: new Date(),
        },
      });

      return { success: true };
    }),

  /**
   * Get catch-up information
   * Returns count of events since last visit and the timestamp
   */
  getCatchUp: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionId) {
      // No session - return default for new visitors (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const count = await ctx.db.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: yesterday },
        },
      });

      return { count, since: yesterday };
    }

    const session = await ctx.db.anonSession.findUnique({
      where: { id: ctx.sessionId },
      select: { lastSeenAt: true },
    });

    if (!session?.lastSeenAt) {
      // Session exists but no lastSeenAt - show last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const count = await ctx.db.event.count({
        where: {
          status: "PUBLISHED",
          occurredAt: { gt: yesterday },
        },
      });

      return { count, since: yesterday };
    }

    // Count events since last visit
    const count = await ctx.db.event.count({
      where: {
        status: "PUBLISHED",
        occurredAt: { gt: session.lastSeenAt },
      },
    });

    return { count, since: session.lastSeenAt };
  }),

  /**
   * Update preferences
   * Stores user preferences in server-side session
   */
  updatePreferences: publicProcedure
    .input(
      z.object({
        preferences: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session",
        });
      }

      const current = await ctx.db.anonSession.findUnique({
        where: { id: ctx.sessionId },
        select: { preferences: true },
      });

      const existingPrefs =
        typeof current?.preferences === "object" && current.preferences !== null
          ? (current.preferences as Record<string, unknown>)
          : {};

      const mergedPreferences = {
        ...existingPrefs,
        ...input.preferences,
      };

      await ctx.db.anonSession.update({
        where: { id: ctx.sessionId },
        data: {
          preferences: mergedPreferences as object,
        },
      });

      return { success: true };
    }),

  /**
   * Mark last seen timestamp
   * Called periodically to track activity
   */
  markSeen: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.sessionId) {
      return { success: false };
    }

    await ctx.db.anonSession.update({
      where: { id: ctx.sessionId },
      data: { lastSeenAt: new Date() },
    });

    return { success: true };
  }),
});
