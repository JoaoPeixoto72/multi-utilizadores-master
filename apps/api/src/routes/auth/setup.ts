/**
 * routes/auth/setup.ts — POST /api/setup
 *
 * R: BUILD_PLAN M1.4 — Setup inicial do super user
 * - Só funciona se zero utilizadores existirem → 404 após execução
 * - Cria o primeiro utilizador (super_user)
 * - Valida política de password
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { countUsers, createUser } from "../../db/queries/users";
import { hashPassword, validatePasswordPolicy } from "../../lib/auth";
import { createLogger, getTraceId } from "../../lib/logger";
import { problemResponse, validationErrorResponse } from "../../lib/problem";
import { buildSessionCookie, createSession } from "../../lib/session";

const SetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export const setupRoute = new Hono<{ Bindings: Env }>();

// GET /api/setup — verifica se setup está disponível
// Retorna { available: true } se zero utilizadores, { available: false } se já feito
setupRoute.get("/api/setup", async (c) => {
  const count = await countUsers(c.env.DB);
  return c.json({ available: count === 0 }, 200);
});

setupRoute.post("/api/setup", zValidator("json", SetupSchema), async (c) => {
  const log = createLogger("setup", getTraceId(c.req.raw));
  const body = c.req.valid("json");

  // 1. Verificar que não existem utilizadores (one-time setup)
  const count = await countUsers(c.env.DB);
  if (count > 0) {
    // Responde como se a rota não existisse (segurança)
    return problemResponse(c, 404, "Not Found", "Route not available");
  }

  // 2. Validar política de password
  const policy = validatePasswordPolicy(body.password);
  if (!policy.valid) {
    return validationErrorResponse(c, [
      { field: "password", message: "Password must meet complexity requirements" },
    ]);
  }

  // 3. Hash e criar utilizador
  const passHash = await hashPassword(body.password);
  const user = await createUser(c.env.DB, {
    email: body.email,
    pass_hash: passHash,
    role: "super_user",
    tenant_id: null,
  });

  // 4. Criar sessão imediata
  const token = await createSession(c.env.DB, user.id, c.env.SESSION_SECRET);

  log.info({ user_id: user.id }, "setup_complete");

  c.header("Set-Cookie", buildSessionCookie(token));
  return c.json({ id: user.id, email: user.email }, 201);
});
