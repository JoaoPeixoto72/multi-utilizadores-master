/**
 * routes/health.ts — Health probes
 *
 * R: STACK_LOCK.md §17, M12 — /health/live + /health/ready
 * GET /api/health/live  → 200 (processo vivo)
 * GET /api/health/ready → 200 se DB acessível, 503 caso contrário
 */
import { Hono } from "hono";

export const healthRoutes = new Hono<{ Bindings: Env }>();

// Liveness — processo está vivo
healthRoutes.get("/health/live", (c) => {
  return c.json({ status: "ok", ts: Date.now() }, 200);
});

// Readiness — DB acessível
healthRoutes.get("/health/ready", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ status: "ready", ts: Date.now() }, 200);
  } catch (_err) {
    return c.json(
      {
        type: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503",
        title: "Service Unavailable",
        status: 503,
        detail: "Database not reachable",
      },
      503,
    );
  }
});
