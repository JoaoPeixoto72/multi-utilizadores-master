/**
 * middleware/csrf.ts — Validação CSRF em mutações
 *
 * R: STACK_LOCK.md §6 — aplicado em POST/PUT/PATCH/DELETE
 * R: STACK_LOCK.md §6 — HMAC-SHA-256 com CSRF_SECRET
 *
 * Rotas isentas de CSRF (seguras por design):
 *   - POST /api/auth/logout — apenas invalida a sessão do próprio utilizador
 *     (não há risco CSRF: um atacante não beneficia de forçar logout de terceiros)
 */
import type { MiddlewareHandler } from "hono";
import { CSRF_HEADER, verifyCsrfToken } from "../lib/csrf";
import { problemResponse } from "../lib/problem";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Rotas explicitamente isentas de verificação CSRF
const CSRF_EXEMPT = new Set(["/api/auth/logout"]);

export const csrfMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (!MUTATING_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  // Isenção para rotas seguras (logout, etc.)
  if (CSRF_EXEMPT.has(c.req.path)) {
    await next();
    return;
  }

  const token = c.req.header(CSRF_HEADER);
  if (!token) {
    return problemResponse(c, 403, "CSRF Token Missing", "X-CSRF-Token header required");
  }

  const valid = await verifyCsrfToken(token, c.env.CSRF_SECRET);
  if (!valid) {
    return problemResponse(c, 403, "CSRF Token Invalid", "Invalid or expired CSRF token");
  }

  await next();
};
