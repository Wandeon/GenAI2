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

const SESSION_COOKIE_NAME = "genai_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export interface SessionData {
  token: string;
  isNew: boolean;
}

/**
 * Get or create session from request
 * Returns session token and whether it's a new session
 */
export async function getOrCreateSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<SessionData> {
  const existingToken = request.cookies[SESSION_COOKIE_NAME];

  if (existingToken) {
    // TODO: Validate token exists in database
    // For now, trust the cookie
    return { token: existingToken, isNew: false };
  }

  // Create new session
  // TODO: Create AnonSession in database
  const newToken = crypto.randomUUID();

  // Set HttpOnly cookie
  reply.setCookie(SESSION_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return { token: newToken, isNew: true };
}

/**
 * Clear session cookie
 */
export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
