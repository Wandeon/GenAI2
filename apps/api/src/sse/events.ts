// apps/api/src/sse/events.ts
import type { FastifyInstance, FastifyReply } from "fastify";

// Store connected clients
const clients = new Set<FastifyReply>();

// Broadcast to all connected clients
export function broadcastNewEvent(eventId: string) {
  const message = JSON.stringify({ type: "new_event", eventId });
  for (const client of clients) {
    try {
      client.raw.write(`data: ${message}\n\n`);
    } catch {
      // Client disconnected, will be cleaned up
      clients.delete(client);
    }
  }
}

// Get client count for monitoring
export function getClientCount(): number {
  return clients.size;
}

export async function registerSSE(fastify: FastifyInstance) {
  // SSE endpoint for real-time event updates
  fastify.get("/api/sse/events", async (request, reply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    });

    // Send initial connection message
    reply.raw.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Add client to set
    clients.add(reply);
    fastify.log.info(`SSE client connected. Total clients: ${clients.size}`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch {
        // Client disconnected
        clearInterval(heartbeat);
        clients.delete(reply);
      }
    }, 30000);

    // Clean up on disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(reply);
      fastify.log.info(`SSE client disconnected. Total clients: ${clients.size}`);
    });

    // Keep connection open (don't call reply.send())
    // Return void to prevent Fastify from closing the response
  });

  // Endpoint to trigger broadcast (called by worker after processing events)
  fastify.post("/api/sse/broadcast", async (request) => {
    const body = request.body as { eventId?: string } | undefined;
    if (body?.eventId) {
      broadcastNewEvent(body.eventId);
      return { ok: true, clients: clients.size, eventId: body.eventId };
    }
    return { ok: false, error: "eventId required" };
  });

  // Endpoint to check SSE health
  fastify.get("/api/sse/health", async () => {
    return { ok: true, clients: clients.size };
  });
}
