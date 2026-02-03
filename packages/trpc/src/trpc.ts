import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

// Context type - will be expanded with session, db, etc.
export interface Context {
  // Placeholder - add session, db client, etc.
}

// Create context for each request
export function createTRPCContext(): Context {
  return {};
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
