/**
 * routes/auth/logout.ts — POST /api/auth/logout
 *
 * R: BUILD_PLAN M1.4 — invalida sessão, limpa cookie
 * R: STACK_LOCK.md §6 — cookie httpOnly cleared
 */
import { Hono } from "hono";

import { createLogger, getTraceId } from "../../lib/logger";
import { buildSessionCookie, deleteSession, extractSessionToken } from "../../lib/session";

export const logoutRoute = new Hono<{ Bindings: Env }>();

logoutRoute.post("/api/auth/logout", async (c) => {
  const log = createLogger("auth.logout", getTraceId(c.req.raw));
  const token = extractSessionToken(c.req.header("cookie") ?? null);

  if (token) {
    await deleteSession(c.env.DB, token);
    log.info({}, "logout_success");
  }

  c.header("Set-Cookie", buildSessionCookie("", true));
  return c.json({ ok: true }, 200);
});
