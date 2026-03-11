/**
 * routes/auth/csrf.ts — GET /api/auth/csrf
 *
 * R: STACK_LOCK.md §6 — CSRF HMAC-SHA-256, CSRF_SECRET
 * R: BUILD_PLAN M1.3 — endpoint para obter CSRF token no frontend
 *
 * Uso: frontend faz GET /api/auth/csrf antes de qualquer mutação
 * Resposta: { token: string }
 */
import { Hono } from "hono";
import { generateCsrfToken } from "../../lib/csrf";

export const csrfRoute = new Hono<{ Bindings: Env }>();

csrfRoute.get("/api/auth/csrf", async (c) => {
  const token = await generateCsrfToken(c.env.CSRF_SECRET);
  return c.json({ token }, 200);
});
