/**
 * routes/auth/me.ts — GET /api/auth/me
 *
 * R: BUILD_PLAN M1.4 — dados do utilizador autenticado
 * R: GS09 — pass_hash NUNCA em respostas JSON
 * R: M02 — auth verificada por handler
 */
import { Hono } from "hono";

import { authMiddleware } from "../../middleware/auth";

export const meRoute = new Hono<{ Bindings: Env }>();

meRoute.get("/api/auth/me", authMiddleware, (c) => {
  const user = c.get("user");
  // Devolver apenas campos públicos — nunca pass_hash (GS09)
  return c.json(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      is_owner: user.is_owner,
      display_name: user.display_name,
    },
    200,
  );
});
