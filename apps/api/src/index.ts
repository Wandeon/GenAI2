import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, createTRPCContext } from "@genai/trpc";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { registerSSE } from "./sse/events";
import { getOrCreateSession } from "./middleware/session";

const server = Fastify({
  logger: true,
});

// Register plugins
await server.register(cors, {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
});

await server.register(cookie, {
  secret: process.env.COOKIE_SECRET || "development-secret-change-in-production",
});

// Register tRPC with Prisma context and session
await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext: async ({ req, res }: CreateFastifyContextOptions) => {
      // Get or create session from HttpOnly cookie
      const session = await getOrCreateSession(req, res);
      return createTRPCContext({ sessionId: session.sessionId });
    },
  },
});

// Register SSE endpoints for real-time updates
await registerSSE(server);

// Health check (both paths for flexibility)
server.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

server.get("/api/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Start server
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

try {
  await server.listen({ port, host });
  console.log(`API server running at http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
