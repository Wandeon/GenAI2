// ============================================================================
// SERVER-SIDE SESSION MIDDLEWARE
// ============================================================================
// Implements Architecture Constitution #5: Server-side identity with HttpOnly cookie
//
// Key principles:
// - Session stored server-side (in database via AnonSession model)
// - Token stored in HttpOnly cookie (not accessible to JavaScript)
// - No localStorage for anything important

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@genai/db";

const SESSION_COOKIE_NAME = "genai_session";
const SESSION_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export interface SessionData {
  sessionId: string;
  token: string;
  isNew: boolean;
}

/**
 * Get or create session from request.
 * Validates token against database and creates new session if needed.
 * Returns session ID, token, and whether it's a new session.
 */
export async function getOrCreateSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SessionData> {
  const existingToken = request.cookies[SESSION_COOKIE_NAME];

  if (existingToken) {
    // Validate token exists in database
    const session = await prisma.anonSession.findUnique({
      where: { token: existingToken },
      select: { id: true, token: true },
    });

    if (session) {
      // Update lastSeenAt asynchronously (don't block response)
      prisma.anonSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {
        // Silently ignore update errors
      });

      return { sessionId: session.id, token: session.token, isNew: false };
    }

    // Token in cookie but not in database - clear stale cookie
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  }

  // Create new session in database
  const newSession = await prisma.anonSession.create({
    data: {},
    select: { id: true, token: true },
  });

  // Set HttpOnly cookie with the token
  reply.setCookie(SESSION_COOKIE_NAME, newSession.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return { sessionId: newSession.id, token: newSession.token, isNew: true };
}

/**
 * Get session from request without creating a new one.
 * Returns null if no valid session exists.
 */
export async function getSession(
  request: FastifyRequest
): Promise<SessionData | null> {
  const existingToken = request.cookies[SESSION_COOKIE_NAME];

  if (!existingToken) {
    return null;
  }

  const session = await prisma.anonSession.findUnique({
    where: { token: existingToken },
    select: { id: true, token: true },
  });

  if (!session) {
    return null;
  }

  return { sessionId: session.id, token: session.token, isNew: false };
}

/**
 * Clear session cookie and optionally delete from database.
 */
export async function clearSession(
  request: FastifyRequest,
  reply: FastifyReply,
  deleteFromDb = false
): Promise<void> {
  const existingToken = request.cookies[SESSION_COOKIE_NAME];

  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });

  if (deleteFromDb && existingToken) {
    await prisma.anonSession.deleteMany({
      where: { token: existingToken },
    }).catch(() => {
      // Silently ignore delete errors
    });
  }
}
