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
   * Add a recent entity search to session preferences
   * Stores up to 8 entries, deduped by slug, newest first
   */
  addRecentSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        slug: z.string().min(1),
        name: z.string().min(1),
        type: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.sessionId) {
        return { success: false };
      }

      const current = await ctx.db.anonSession.findUnique({
        where: { id: ctx.sessionId },
        select: { preferences: true },
      });

      const prefs =
        typeof current?.preferences === "object" && current.preferences !== null
          ? (current.preferences as Record<string, unknown>)
          : {};

      const existing = Array.isArray(prefs.recentSearches)
        ? (prefs.recentSearches as Array<Record<string, unknown>>)
        : [];

      const entry = {
        query: input.query,
        slug: input.slug,
        name: input.name,
        type: input.type,
        timestamp: new Date().toISOString(),
      };

      // Remove duplicate by slug, prepend new entry, cap at 8
      const filtered = existing.filter((e) => e.slug !== input.slug);
      const updated = [entry, ...filtered].slice(0, 8);

      await ctx.db.anonSession.update({
        where: { id: ctx.sessionId },
        data: {
          preferences: { ...prefs, recentSearches: updated } as object,
        },
      });

      return { success: true };
    }),

  /**
   * Get recent entity searches from session preferences
   */
  getRecentSearches: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionId) {
      return [];
    }

    const session = await ctx.db.anonSession.findUnique({
      where: { id: ctx.sessionId },
      select: { preferences: true },
    });

    const prefs =
      typeof session?.preferences === "object" && session.preferences !== null
        ? (session.preferences as Record<string, unknown>)
        : {};

    if (!Array.isArray(prefs.recentSearches)) {
      return [];
    }

    return prefs.recentSearches as Array<{
      query: string;
      slug: string;
      name: string;
      type: string;
      timestamp: string;
    }>;
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
