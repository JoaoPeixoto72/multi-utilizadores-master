/**
 * routes/auth/login.ts — POST /api/auth/login
 *
 * R: BUILD_PLAN M1.4 — login único, rate limiting, sessão única, cookie httpOnly
 * R: STACK_LOCK.md §6 — erros_auth sempre genéricos (nunca revelar email/pw/estado)
 * R: STACK_LOCK.md §5 — 4 camadas: route → handler → service → db/queries
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { getUserByEmail } from "../../db/queries/users";
import { verifyPassword } from "../../lib/auth";
import { createLogger, getTraceId } from "../../lib/logger";
import { authErrorResponse } from "../../lib/problem";
import { buildSessionCookie, createSession } from "../../lib/session";
import { loginRateLimit } from "../../middleware/rate-limit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginRoute = new Hono<{ Bindings: Env }>();

loginRoute.post("/api/auth/login", loginRateLimit, zValidator("json", LoginSchema), async (c) => {
  const log = createLogger("auth.login", getTraceId(c.req.raw));
  const body = c.req.valid("json");

  // 1. Lookup user (sempre genérico — não revelar se email existe)
  const user = await getUserByEmail(c.env.DB, body.email);
  if (!user) {
    log.warn({}, "login_user_not_found");
    return authErrorResponse(c);
  }

  // 2. Verificar password (timing-safe via bcryptjs.compare)
  const valid = await verifyPassword(body.password, user.pass_hash);
  if (!valid) {
    log.warn({ user_id: user.id }, "login_invalid_password");
    return authErrorResponse(c);
  }

  // 3. Criar sessão (invalida anteriores — uma_por_user)
  const token = await createSession(c.env.DB, user.id, c.env.SESSION_SECRET);

  log.info({ user_id: user.id }, "login_success");

  // 4. Definir cookie httpOnly + devolver dados públicos (nunca pass_hash)
  c.header("Set-Cookie", buildSessionCookie(token));
  return c.json(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
    200,
  );
});
