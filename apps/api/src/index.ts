import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter, type Context } from "@genai/trpc";

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

// Create tRPC context
function createContext(): Context {
  // TODO: Add session, db client, etc.
  return {};
}

// Register tRPC
await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

// Health check
server.get("/health", async () => {
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
