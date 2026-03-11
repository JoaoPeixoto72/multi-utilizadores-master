/**
 * routes/user/index.ts — Rotas de utilizador autenticado (M4 + M5)
 *
 * R: BUILD_PLAN.md §M4.1, §M5.2
 * R: briefing.md §3.5, §3.6, §3.8, §3.9
 * R: STACK_LOCK.md §5 — auth obrigatório; IDOR pelo userId da sessão
 * R: GS09 — pass_hash nunca em respostas
 *
 * Endpoints M4:
 *   GET    /api/user/modules        — módulos disponíveis
 *   DELETE /api/user/me             — auto-eliminação (soft delete)
 *
 * Endpoints M5:
 *   GET    /api/user/profile               — perfil próprio
 *   PATCH  /api/user/profile               — actualizar dados pessoais
 *   POST   /api/user/profile/avatar        — upload foto de perfil (multipart/form-data)
 *   DELETE /api/user/profile/avatar        — remover foto de perfil
 *   POST   /api/user/profile/change-email  — pedir alteração de email
 *   GET    /api/user/confirm-email/:token  — confirmar alteração de email (público)
 *   POST   /api/user/profile/change-password — alterar password
 *   GET    /api/user/profile/export-rgpd   — exportar dados RGPD
 */

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createLogger, getTraceId } from "../../lib/logger.js";
import { getRegisteredModules } from "../../lib/module-registry.js";
import { problemResponse } from "../../lib/problem.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  changePassword,
  confirmEmailChangeToken,
  deleteAvatar,
  exportRgpd,
  getProfile,
  type ProfileServiceError,
  patchProfile,
  requestEmailChange,
  uploadAvatar,
} from "../../services/profile.service.js";
import {
  getUserModulesWithProfile,
  selfDeleteUser,
  type UserServiceError,
} from "../../services/user.service.js";

export const userRouter = new Hono<{ Bindings: Env }>();

// Todos os endpoints requerem sessão válida (excepto confirm-email que é público)
// Nota: "/profile*" não faz match de "/profile" exacto em Hono — listar explicitamente
userRouter.use("/profile", authMiddleware);
userRouter.use("/profile/*", authMiddleware);
userRouter.use("/modules", authMiddleware);
userRouter.use("/me", authMiddleware);
userRouter.use("/nav", authMiddleware);

// ── GET /api/user/modules ─────────────────────────────────────────────────────
userRouter.get("/modules", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/modules", getTraceId(c.req.raw));

  try {
    const { modules, profile } = await getUserModulesWithProfile(c.env.DB, sessionUser.id);
    log.info({ user_id: sessionUser.id, count: modules.length }, "modules_fetched");
    return c.json({
      modules,
      role: profile.role,
      is_owner: profile.is_owner,
      is_temp_owner: profile.is_temp_owner,
    });
  } catch (err) {
    const e = err as UserServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "modules_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── GET /api/user/nav ─────────────────────────────────────────────────────────
// Devolve itens de navegação filtrados por role + permissões do utilizador.
// super_user: itens super; admin/owner: todos os módulos; collaborator: só os autorizados.
userRouter.get("/nav", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/nav", getTraceId(c.req.raw));

  try {
    const { modules, profile } = await getUserModulesWithProfile(c.env.DB, sessionUser.id);

    const isAdmin =
      profile.role === "tenant_admin" ||
      profile.role === "super_user" ||
      profile.is_owner === 1 ||
      profile.is_temp_owner === 1;

    // Construir itens de nav baseados nos módulos com acesso
    const allModules = getRegisteredModules();
    const navItems = allModules
      .filter((mod) => {
        const entry = modules.find((m) => m.id === mod.id);
        return isAdmin || (entry?.has_access ?? false);
      })
      .map((mod) => ({
        id: mod.id,
        name_key: mod.name_key,
        icon: mod.icon,
        integrations_required: mod.integrations_required,
      }));

    log.info({ user_id: sessionUser.id, count: navItems.length }, "nav_fetched");
    return c.json({ items: navItems, role: profile.role, is_owner: profile.is_owner });
  } catch (err) {
    log.error({ err }, "nav_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── DELETE /api/user/me ───────────────────────────────────────────────────────
userRouter.delete("/me", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/self-delete", getTraceId(c.req.raw));

  try {
    await selfDeleteUser(c.env.DB, sessionUser.id);
    c.header("Set-Cookie", "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    log.info({ user_id: sessionUser.id }, "self_deleted");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as UserServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "self_delete_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── GET /api/user/profile ─────────────────────────────────────────────────────
userRouter.get("/profile", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/profile", getTraceId(c.req.raw));

  try {
    const profile = await getProfile(c.env.DB, sessionUser.id);
    return c.json(profile);
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "profile_get_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── PATCH /api/user/profile ───────────────────────────────────────────────────
const patchProfileSchema = z.object({
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  display_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  website: z.string().url().max(255).nullable().optional(),
  preferred_language: z.enum(["pt", "en"]).optional(),
});

userRouter.patch("/profile", zValidator("json", patchProfileSchema), async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/profile-patch", getTraceId(c.req.raw));
  const input = c.req.valid("json");

  try {
    await patchProfile(c.env.DB, sessionUser.id, input);
    log.info({ user_id: sessionUser.id }, "profile_updated");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "profile_patch_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/user/profile/avatar ─────────────────────────────────────────────
// Aceita multipart/form-data com campo "file" (binário WebP)
userRouter.post("/profile/avatar", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/avatar-upload", getTraceId(c.req.raw));

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return problemResponse(c, 400, "Campo 'file' obrigatório.", "missing_file");
    }

    const buffer = await file.arrayBuffer();
    const key = await uploadAvatar(c.env.DB, c.env.R2_BUCKET, sessionUser.id, buffer);

    log.info({ user_id: sessionUser.id, key }, "avatar_uploaded");
    return c.json({ ok: true, avatar_key: key });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "avatar_upload_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── DELETE /api/user/profile/avatar ──────────────────────────────────────────
userRouter.delete("/profile/avatar", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/avatar-delete", getTraceId(c.req.raw));

  try {
    await deleteAvatar(c.env.DB, c.env.R2_BUCKET, sessionUser.id);
    log.info({ user_id: sessionUser.id }, "avatar_deleted");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "avatar_delete_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/user/profile/change-email ──────────────────────────────────────
const changeEmailSchema = z.object({
  current_password: z.string().min(1),
  new_email: z.string().email().max(255),
});

userRouter.post("/profile/change-email", zValidator("json", changeEmailSchema), async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/change-email", getTraceId(c.req.raw));
  const { current_password, new_email } = c.req.valid("json");

  try {
    const result = await requestEmailChange(c.env.DB, sessionUser.id, current_password, new_email);
    log.info({ user_id: sessionUser.id }, "email_change_requested");
    // Em M7 o token será enviado por email — aqui retornamos para debug/dev
    return c.json({ ok: true, debug_token: result.token });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "change_email_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── GET /api/user/confirm-email/:token ───────────────────────────────────────
// Endpoint PÚBLICO — chamado via link no email
userRouter.get("/confirm-email/:token", async (c) => {
  const token = c.req.param("token");
  const log = createLogger("user/confirm-email", getTraceId(c.req.raw));

  try {
    await confirmEmailChangeToken(c.env.DB, token);
    log.info({}, "email_confirmed");
    // Redirigir para login (sessão foi invalidada)
    return c.redirect("/login?email_confirmed=1");
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ err: String(err) }, "confirm_email_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── POST /api/user/profile/change-password ───────────────────────────────────
const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(12).max(128),
});

userRouter.post("/profile/change-password", zValidator("json", changePasswordSchema), async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/change-password", getTraceId(c.req.raw));
  const { current_password, new_password } = c.req.valid("json");

  try {
    await changePassword(c.env.DB, sessionUser.id, current_password, new_password);
    log.info({ user_id: sessionUser.id }, "password_changed");
    return c.json({ ok: true });
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "change_password_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});

// ── GET /api/user/profile/export-rgpd ────────────────────────────────────────
userRouter.get("/profile/export-rgpd", async (c) => {
  const sessionUser = c.get("user");
  const log = createLogger("user/export-rgpd", getTraceId(c.req.raw));

  try {
    const data = await exportRgpd(c.env.DB, sessionUser.id);
    log.info({ user_id: sessionUser.id }, "rgpd_exported");
    c.header("Content-Disposition", `attachment; filename="dados-pessoais-${sessionUser.id}.json"`);
    c.header("Content-Type", "application/json");
    return c.json(data);
  } catch (err) {
    const e = err as ProfileServiceError;
    if (e.code && e.status) return problemResponse(c, e.status, e.message, e.code);
    log.error({ user_id: sessionUser.id, err: String(err) }, "export_rgpd_error");
    return problemResponse(c, 500, "Erro interno.", "internal_error");
  }
});
