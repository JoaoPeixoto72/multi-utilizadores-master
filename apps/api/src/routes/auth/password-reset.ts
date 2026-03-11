/**
 * routes/auth/password-reset.ts — Password reset (request + confirm)
 *
 * R: BUILD_PLAN M1.4/M1.5
 * R: STACK_LOCK.md §6 — token expira 1h, uso único, resposta sempre neutra
 *
 * POST /api/auth/password-reset/request — pedido de reset
 * POST /api/auth/password-reset/confirm  — confirmar com token
 */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  createPasswordReset,
  getPasswordResetByHash,
  markPasswordResetUsed,
} from "../../db/queries/password-resets";
import { deleteAllUserSessions } from "../../db/queries/sessions";
import { getUserByEmail, updateUserPassword } from "../../db/queries/users";
import { hashPassword, validatePasswordPolicy } from "../../lib/auth";
import { passwordResetTemplate } from "../../lib/integrations/email/templates/index.js";
import { createLogger, getTraceId } from "../../lib/logger";
import { problemResponse, validationErrorResponse } from "../../lib/problem";
import { EXPIRY, expiresIn, generateOneTimeToken, hashToken } from "../../lib/token";
import { resetRateLimit } from "../../middleware/rate-limit";
import { sendEmail } from "../../services/integration.service.js";

const RequestSchema = z.object({
  email: z.string().email(),
});

const ConfirmSchema = z.object({
  token: z.string().min(64),
  password: z.string().min(12),
});

export const passwordResetRoute = new Hono<{ Bindings: Env }>();

// ── Request ────────────────────────────────────────────────────────────────────
passwordResetRoute.post(
  "/api/auth/password-reset/request",
  resetRateLimit,
  zValidator("json", RequestSchema),
  async (c) => {
    const log = createLogger("auth.reset.request", getTraceId(c.req.raw));
    const body = c.req.valid("json");

    // Resposta sempre neutra (não revelar se email existe)
    const neutralResponse = () => c.json({ ok: true }, 200);

    const user = await getUserByEmail(c.env.DB, body.email);
    if (!user) {
      log.info({}, "reset_request_email_not_found");
      return neutralResponse();
    }

    // Gerar token (raw → email; hash → DB)
    const { raw, hash } = await generateOneTimeToken();
    const expiresAt = expiresIn(EXPIRY.PASSWORD_RESET);

    await createPasswordReset(c.env.DB, user.id, hash, expiresAt);

    // M7: enviar email com link de reset (se integração de email activa)
    const origin = new URL(c.req.url).origin;
    const resetUrl = `${origin}/password-reset/${raw}`;
    const emailTpl = passwordResetTemplate({
      userEmail: body.email,
      resetUrl,
      expiresIn: "1 hora",
    });
    await sendEmail(c.env.DB, c.env.ENCRYPTION_KEY, {
      to: body.email,
      subject: emailTpl.subject,
      html: emailTpl.html,
      text: emailTpl.text,
    }).catch(() => {}); // não falhar se email não configurado

    log.info({ user_id: user.id }, "reset_token_created");

    // Em dev: devolver token no body para testes (remover em produção)
    const isDev = c.env.APP_ENV !== "production";
    if (isDev) {
      return c.json({ ok: true, _dev_token: raw }, 200);
    }

    return neutralResponse();
  },
);

// ── Confirm ────────────────────────────────────────────────────────────────────
passwordResetRoute.post(
  "/api/auth/password-reset/confirm",
  zValidator("json", ConfirmSchema),
  async (c) => {
    const log = createLogger("auth.reset.confirm", getTraceId(c.req.raw));
    const body = c.req.valid("json");

    // 1. Hash do token recebido para lookup
    const tokenHash = await hashToken(body.token);
    const reset = await getPasswordResetByHash(c.env.DB, tokenHash);

    if (!reset) {
      return problemResponse(c, 400, "Invalid Token", "Token is invalid or expired");
    }

    // 2. Validar política de password
    const policy = validatePasswordPolicy(body.password);
    if (!policy.valid) {
      return validationErrorResponse(c, [
        { field: "password", message: "Password must meet complexity requirements" },
      ]);
    }

    // 3. Actualizar password + marcar token como usado + invalidar sessões
    const passHash = await hashPassword(body.password);
    await Promise.all([
      updateUserPassword(c.env.DB, reset.user_id, passHash),
      markPasswordResetUsed(c.env.DB, reset.id),
      deleteAllUserSessions(c.env.DB, reset.user_id),
    ]);

    log.info({ user_id: reset.user_id }, "password_reset_complete");

    return c.json({ ok: true }, 200);
  },
);
