import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma, type PrismaClient } from "@genai/db";

// Context type with database client and optional session
export interface Context {
  db: PrismaClient;
  sessionId?: string;
}

// Options for creating context
export interface CreateContextOptions {
  sessionId?: string;
}

// Create context for each request
export function createTRPCContext(opts?: CreateContextOptions): Context {
  return {
    db: prisma,
    sessionId: opts?.sessionId,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;
