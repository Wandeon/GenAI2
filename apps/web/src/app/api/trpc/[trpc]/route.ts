import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@genai/trpc";

// Note: Session handling is done at the API layer (Fastify).
// This Next.js route is for SSR and works without session context.
// The web app calls the Fastify API for session-aware operations.
const handler = async (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
  });

export { handler as GET, handler as POST };
