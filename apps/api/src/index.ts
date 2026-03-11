/**
 * apps/api/src/index.ts — Hono app entry point
 *
 * R: STACK_LOCK.md §4, §5
 * - Export AppType para cliente RPC tipado (GS06)
 * - Export RateLimiter DO (obrigatório para wrangler.toml)
 * - 4 camadas: routes → handlers → services → db/queries
 * - Zero +server.ts (GS05)
 */
import { Hono } from "hono";
import { csrfMiddleware } from "./middleware/csrf";
import {
  errorHandler,
  requestLogger,
  traceMiddleware,
  withGracefulShutdown,
} from "./middleware/observability";
import { securityHeaders } from "./middleware/security-headers";
import { adminActivityRouter } from "./routes/admin/activity";
import { adminBackupsRouter } from "./routes/admin/backups";
import { companyRouter } from "./routes/admin/company";
import { adminTeamRouter } from "./routes/admin/team";
import { csrfRoute } from "./routes/auth/csrf";
import { loginRoute } from "./routes/auth/login";
import { logoutRoute } from "./routes/auth/logout";
import { meRoute } from "./routes/auth/me";
import { passwordResetRoute } from "./routes/auth/password-reset";
import { setupRoute } from "./routes/auth/setup";
import { healthRoutes } from "./routes/health";
import { invitationsRouter } from "./routes/invitations/accept";
import { superAuditRouter } from "./routes/super/audit";
import { superBackupsRouter } from "./routes/super/backups";
import { superIntegrationsRouter } from "./routes/super/integrations";
import { superSettingsRouter } from "./routes/super/settings";
import { superTenantsRouter } from "./routes/super/tenants";
import { userRouter } from "./routes/user/index";
import { notificationsRouter } from "./routes/user/notifications";
import { scheduleAutoBackup } from "./services/backup.service";
import { expireElevations } from "./services/tenant.service";

// ── Re-export Durable Object (obrigatório para wrangler) ──────────────────────
export { RateLimiter } from "./lib/rate-limiter-do";

// ── App Hono tipada com Env ───────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>();

// ── Security headers (M14) ───────────────────────────────────────────────────
app.use("*", securityHeaders);

// ── Observabilidade global (M13) ─────────────────────────────────────────────
app.use("*", traceMiddleware);
app.use("*", requestLogger);
app.onError(errorHandler);

// ── Health probes (M13) ───────────────────────────────────────────────────────
app.route("/api", healthRoutes);

// ── CSRF token ────────────────────────────────────────────────────────────────
app.route("/", csrfRoute);

// ── CSRF middleware global (POST/PUT/PATCH/DELETE) ────────────────────────────
app.use("/api/*", csrfMiddleware);

// ── Setup inicial (one-time) ──────────────────────────────────────────────────
app.route("/", setupRoute);

// ── Autenticação ──────────────────────────────────────────────────────────────
app.route("/", loginRoute);
app.route("/", logoutRoute);
app.route("/", meRoute);
app.route("/", passwordResetRoute);

// ── M2: Super User + Convites ─────────────────────────────────────────────────
app.route("/api/super", superTenantsRouter);
app.route("/api/super", superIntegrationsRouter);
app.route("/api/super", superSettingsRouter);
app.route("/api/invitations", invitationsRouter);

// ── M3: Admin + Equipa ────────────────────────────────────────────────────────
app.route("/api/admin/team", adminTeamRouter);

// ── M4: Utilizador ────────────────────────────────────────────────────────────
app.route("/api/user", userRouter);

// ── M6: Notificações ──────────────────────────────────────────────────────────
app.route("/api/user/notifications", notificationsRouter);

// ── M5: Empresa (perfil + logo) ───────────────────────────────────────────────
app.route("/api/admin/company", companyRouter);

// ── M8: Backups ───────────────────────────────────────────────────────────────
app.route("/api/admin", adminActivityRouter);
app.route("/api/admin", adminBackupsRouter);
app.route("/api/super", superAuditRouter);
app.route("/api/super", superBackupsRouter);

// ── Rota de fallback ──────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    {
      type: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404",
      title: "Not Found",
      status: 404,
      detail: `Route ${c.req.path} not found`,
    },
    404,
  );
});

// ── Criador de instância (necessário para hooks.server.ts) ────────────────────
export function createHonoApp() {
  return app;
}

// ── AppType — exportado para o cliente RPC tipado (GS06) ─────────────────────
export type AppType = typeof app;

// ── Scheduled handler — cron 0 0 * * * (backup automático M8) ────────────────
export default {
  fetch: withGracefulShutdown(app.fetch),
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await scheduleAutoBackup(env.DB, env.R2_BUCKET);
    await expireElevations(env.DB);
  },
};
