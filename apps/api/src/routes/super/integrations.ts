/**
 * routes/super/integrations.ts — Gestão de integrações externas (M7)
 *
 * R: BUILD_PLAN.md §M7.3
 * R: STACK_LOCK.md §5 — 4 camadas, super_user apenas
 *
 * Endpoints:
 *   GET    /api/super/integrations                  — listar todas
 *   POST   /api/super/integrations                  — criar
 *   PATCH  /api/super/integrations/:id              — actualizar credenciais
 *   POST   /api/super/integrations/:id/test         — testar ping
 *   POST   /api/super/integrations/:id/activate     — activar
 *   POST   /api/super/integrations/:id/deactivate   — desactivar
 *   DELETE /api/super/integrations/:id              — eliminar
 *   POST   /api/super/integrations/verify-email     — enviar email de verificação real
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware, requireSuperUser } from "../../middleware/auth.js";
import {
  activateIntegrationById,
  createIntegration,
  deactivateIntegrationById,
  getActiveEmailAdapter,
  getAllIntegrations,
  getEmailAdapterById,
  type IntegrationServiceError,
  removeIntegration,
  testIntegration,
  updateCredentials,
} from "../../services/integration.service.js";

type Bindings = Env;

export const superIntegrationsRouter = new Hono<{ Bindings: Bindings }>();

superIntegrationsRouter.use("*", authMiddleware);
superIntegrationsRouter.use("*", requireSuperUser);

// ── Schemas ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "email",
  "sms",
  "llm",
  "cloud_storage",
  "calendar",
  "payments",
  "invoicing",
  "pdf",
] as const;

const CreateSchema = z.object({
  category: z.enum(CATEGORIES),
  provider: z.string().min(1).max(50),
  credentials: z.record(z.string(), z.string()),
});

const UpdateSchema = z.object({
  credentials: z.record(z.string(), z.string()),
});

// ── GET /api/super/integrations ───────────────────────────────────────────────
superIntegrationsRouter.get("/integrations", async (c) => {
  const log = createLogger("super.integrations.list", getTraceId(c.req.raw));
  try {
    const rows = await getAllIntegrations(c.env.DB);
    return c.json({ data: rows });
  } catch (err) {
    log.error({ err: String(err) }, "integrations_list_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/super/integrations ──────────────────────────────────────────────
superIntegrationsRouter.post("/integrations", zValidator("json", CreateSchema), async (c) => {
  const log = createLogger("super.integrations.create", getTraceId(c.req.raw));
  const input = c.req.valid("json");

  if (!c.env.ENCRYPTION_KEY) {
    return problemResponse(c, 500, "ENCRYPTION_KEY não configurada.", "missing_encryption_key");
  }

  try {
    const id = await createIntegration(c.env.DB, c.env.ENCRYPTION_KEY, input);
    log.info({ id, category: input.category, provider: input.provider }, "integration_created");
    return c.json({ id }, 201);
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ err: String(err) }, "integration_create_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── PATCH /api/super/integrations/:id ────────────────────────────────────────
superIntegrationsRouter.patch("/integrations/:id", zValidator("json", UpdateSchema), async (c) => {
  const log = createLogger("super.integrations.update", getTraceId(c.req.raw));
  const id = c.req.param("id");
  const { credentials } = c.req.valid("json");

  if (!c.env.ENCRYPTION_KEY) {
    return problemResponse(c, 500, "ENCRYPTION_KEY não configurada.", "missing_encryption_key");
  }

  try {
    await updateCredentials(c.env.DB, c.env.ENCRYPTION_KEY, id, credentials);
    log.info({ id }, "integration_credentials_updated");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, err: String(err) }, "integration_update_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/super/integrations/:id/test ─────────────────────────────────────
superIntegrationsRouter.post("/integrations/:id/test", async (c) => {
  const log = createLogger("super.integrations.test", getTraceId(c.req.raw));
  const id = c.req.param("id");

  if (!c.env.ENCRYPTION_KEY) {
    return problemResponse(c, 500, "ENCRYPTION_KEY não configurada.", "missing_encryption_key");
  }

  try {
    const result = await testIntegration(c.env.DB, c.env.ENCRYPTION_KEY, id);
    log.info({ id, ok: result.ok }, "integration_tested");
    return c.json(result);
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, err: String(err) }, "integration_test_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/super/integrations/:id/activate ────────────────────────────────
superIntegrationsRouter.post("/integrations/:id/activate", async (c) => {
  const log = createLogger("super.integrations.activate", getTraceId(c.req.raw));
  const id = c.req.param("id");

  try {
    await activateIntegrationById(c.env.DB, id);
    log.info({ id }, "integration_activated");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, err: String(err) }, "integration_activate_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/super/integrations/:id/deactivate ──────────────────────────────
superIntegrationsRouter.post("/integrations/:id/deactivate", async (c) => {
  const log = createLogger("super.integrations.deactivate", getTraceId(c.req.raw));
  const id = c.req.param("id");

  try {
    await deactivateIntegrationById(c.env.DB, id);
    log.info({ id }, "integration_deactivated");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, err: String(err) }, "integration_deactivate_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/super/integrations/verify-email ─────────────────────────────────
// Envia email de verificação real para confirmar que a integração funciona.
// O email contém um link de confirmação para o super utilizador clicar.
superIntegrationsRouter.post("/integrations/verify-email", async (c) => {
  const log = createLogger("super.integrations.verify-email", getTraceId(c.req.raw));

  if (!c.env.ENCRYPTION_KEY) {
    return problemResponse(c, 500, "ENCRYPTION_KEY não configurada.", "missing_encryption_key");
  }

  let body: { id?: string; email?: string };
  try {
    body = (await c.req.json()) as { id?: string; email?: string };
  } catch {
    return problemResponse(c, 400, "Body JSON inválido.", "invalid_json");
  }

  const { id, email } = body;
  if (!id || typeof id !== "string") {
    return problemResponse(c, 400, "Campo 'id' obrigatório.", "missing_id");
  }
  if (!email || !email.includes("@")) {
    return problemResponse(c, 400, "Email de destino inválido.", "invalid_email");
  }

  try {
    const result = await testIntegration(c.env.DB, c.env.ENCRYPTION_KEY, id);
    if (!result.ok) {
      return problemResponse(c, 422, `Ligação falhou: ${result.message}`, "connection_failed");
    }

    // Aguardar 1.5s para evitar rate limit Resend (2 req/s) após o ping de teste
    await new Promise((r) => setTimeout(r, 1500));
    const appUrl = c.env.APP_URL ?? "https://cf-base.acemang-jedi.workers.dev";
    const verifyToken = crypto.randomUUID();
    const confirmUrl = `${appUrl}/super/integrations/confirm?token=${verifyToken}&id=${id}`;

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificação de Integração de Email</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; }
    .card { background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    .header { background: #1e293b; padding: 24px 32px; }
    .header h1 { margin: 0; color: #f1f5f9; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; color: #334155; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 24px; background: #16a34a; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 16px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; }
    .badge { display: inline-block; padding: 4px 10px; background: #dcfce7; color: #16a34a; border-radius: 4px; font-weight: 600; font-size: 13px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header"><h1>cf‑base — Verificação de Email</h1></div>
      <div class="body">
        <p>Olá,</p>
        <p>Este é um email de verificação enviado pela plataforma <strong>cf‑base</strong> para confirmar que a integração de email está a funcionar correctamente.</p>
        <p>Clique no botão abaixo para confirmar que recebeu este email:</p>
        <a href="${confirmUrl}" class="btn">✓ Confirmar Recepção</a>
        <p style="color:#64748b;font-size:13px;">Ou copie este URL: ${confirmUrl}</p>
        <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
          <span class="badge">Integração activa</span>&nbsp; A sua integração de email está configurada e operacional.
        </p>
      </div>
      <div class="footer">Este email foi enviado automaticamente para verificar a integração. Se não reconhece este pedido, pode ignorar.</div>
    </div>
  </div>
</body>
</html>`;

    const adapter = await getEmailAdapterById(c.env.DB, c.env.ENCRYPTION_KEY, id);
    if (!adapter) {
      return problemResponse(
        c,
        422,
        "Integração não encontrada ou não é de email.",
        "no_email_adapter",
      );
    }

    await adapter.send({
      to: email,
      subject: "✓ Verificação da integração de email — cf‑base",
      html,
      text: `Verificação da integração de email\n\nClique em: ${confirmUrl}\n\nSe não reconhece este pedido, pode ignorar.`,
    });

    log.info({ id, email }, "verify_email_sent");
    return c.json({ ok: true, message: `Email de verificação enviado para ${email}.` });
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, email, err: String(err) }, "verify_email_error");
    return problemResponse(c, 500, `Erro ao enviar email: ${String(err)}`, "send_error");
  }
});

// ── DELETE /api/super/integrations/:id ───────────────────────────────────────
superIntegrationsRouter.delete("/integrations/:id", async (c) => {
  const log = createLogger("super.integrations.delete", getTraceId(c.req.raw));
  const id = c.req.param("id");

  try {
    await removeIntegration(c.env.DB, id);
    log.info({ id }, "integration_deleted");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as IntegrationServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ id, err: String(err) }, "integration_delete_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});
