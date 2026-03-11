/**
 * middleware/auth.ts — Guard de autenticação
 *
 * R: STACK_LOCK.md §5 — auth verificada em handlers (não só middleware global)
 * R: STACK_LOCK.md §6 — sessões D1 + signed_token
 * R: M02 — auth verificada por handler (M02 verifica em cada rota protegida)
 *
 * Uso:
 *   app.use("/api/protected/*", authMiddleware)
 */
import type { MiddlewareHandler } from "hono";
import { getUserById } from "../db/queries/users.js";
import { createLogger, getTraceId } from "../lib/logger.js";
import { problemResponse } from "../lib/problem.js";
import { extractSessionToken, getSession } from "../lib/session.js";

export interface AuthUser {
  id: string;
  email: string;
  role: "super_user" | "tenant_admin" | "member" | "collaborator" | "client";
  tenant_id: string | null;
  is_owner: number;
  is_temp_owner: number;
  status: "active" | "inactive" | "deleted";
  display_name: string | null;
}

// Declarar tipo para c.var.user
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    traceId: string;
  }
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const log = createLogger("auth", getTraceId(c.req.raw));
  const cookie = c.req.header("cookie") ?? null;
  const token = extractSessionToken(cookie);

  c.set("traceId", getTraceId(c.req.raw));

  if (!token) {
    return problemResponse(c, 401, "Authentication Required", "No session token");
  }

  const userId = await getSession(c.env.DB, token, c.env.SESSION_SECRET);
  if (!userId) {
    log.warn({ path: c.req.path }, "invalid_or_expired_session");
    return problemResponse(c, 401, "Authentication Required", "Invalid or expired session");
  }

  const user = await getUserById(c.env.DB, userId);
  if (!user) {
    log.warn({ user_id: userId }, "session_user_not_found");
    return problemResponse(c, 401, "Authentication Required", "User not found");
  }

  if (user.status !== "active") {
    return problemResponse(c, 401, "Authentication Required", "Account is not active");
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    role: user.role,
    tenant_id: user.tenant_id,
    is_owner: user.is_owner,
    is_temp_owner: user.is_temp_owner,
    status: user.status,
    display_name: user.display_name,
  });
  await next();
};

/** Guard: apenas super_user pode aceder */
export const requireSuperUser: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "super_user") {
    return problemResponse(c, 403, "Forbidden", "Super user access required");
  }
  await next();
};

/** Guard: apenas owner fixo ou owner temporário activo */
export const requireOwner: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get("user");
  const isOwnerFixed = user?.is_owner === 1 && user?.is_temp_owner === 0;
  const isOwnerTemp = user?.is_temp_owner === 1 && user?.role === "member";

  if (!isOwnerFixed && !isOwnerTemp) {
    return problemResponse(c, 403, "Forbidden", "Owner access required");
  }
  await next();
};

/** Guard: tenant_admin, is_owner, is_temp_owner, ou super_user */
export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get("user");
  const allowed =
    user?.role === "super_user" ||
    user?.role === "tenant_admin" ||
    user?.is_owner === 1 ||
    user?.is_temp_owner === 1;

  if (!allowed) {
    return problemResponse(c, 403, "Forbidden", "Admin access required");
  }
  await next();
};
