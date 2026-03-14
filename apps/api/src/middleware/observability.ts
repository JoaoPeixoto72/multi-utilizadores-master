/**
 * middleware/observability.ts — Observabilidade (M13)
 *
 * R: BUILD_PLAN.md §M13 — trace_id, request logging, graceful shutdown
 *
 * 1. traceMiddleware — propaga X-Trace-Id em cada pedido/resposta
 * 2. requestLogger   — log estruturado JSON de entrada + saída
 * 3. errorHandler    — captura excepções não tratadas, regista sem PII
 * 4. withGracefulShutdown — ctx.waitUntil (Workers, equivalente a SIGTERM drain)
 */

import type { Context, MiddlewareHandler } from "hono";
import { createLogger, getTraceId } from "../lib/logger.js";

// ── 1. Trace-ID middleware ─────────────────────────────────────────────────────

/**
 * Propaga um trace_id consistente em cada pedido:
 *  - Lê `X-Trace-Id` do request header (se existir)
 *  - Gera um novo UUID v4 caso contrário
 *  - Armazena em `c.var.traceId` para uso nos handlers
 *  - Devolve `X-Trace-Id` na resposta
 */
export const traceMiddleware: MiddlewareHandler = async (c, next) => {
  const traceId = getTraceId(c.req.raw);
  c.set("traceId", traceId);
  await next();
  c.res.headers.set("x-trace-id", traceId);
};

// ── 2. Request logger middleware ───────────────────────────────────────────────

/**
 * Registo estruturado JSON de cada pedido HTTP.
 * Zero PII: nunca regista corpo do pedido, cookies, passwords ou emails.
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const traceId = (c.var as { traceId?: string }).traceId ?? getTraceId(c.req.raw);
  const log = createLogger("http", traceId);
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  log.info({ method, path }, "request_start");

  await next();

  const status = c.res.status;
  const durationMs = Date.now() - start;
  const level: "error" | "warn" | "info" =
    status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  log[level]({ method, path, status, duration_ms: durationMs }, "request_end");
};

// ── 3. Global error handler ────────────────────────────────────────────────────

/**
 * Global error handler para app.onError(errorHandler).
 * Captura excepções não tratadas nos handlers Hono.
 * Regista sem PII e devolve RFC 9457 Problem JSON.
 * Sentry: envia se SENTRY_DSN estiver configurado (via c.env).
 */
export const errorHandler = async (
  err: Error,
  c: Context<{ Bindings: Env }>,
): Promise<Response> => {
  const traceId = (c.var as { traceId?: string }).traceId ?? getTraceId(c.req.raw);
  const log = createLogger("error_handler", traceId);

  // Redact: nunca logar mensagem completa se contiver PII
  const safeMessage = redactPii(err.message);
  log.error(
    {
      error_name: err.name,
      error_message: safeMessage,
      path: c.req.path,
      method: c.req.method,
      trace_id: traceId,
    },
    "unhandled_exception",
  );

  // Sentry (opcional) — fire-and-forget, nunca bloqueia a resposta
  if (c.env.SENTRY_DSN) {
    captureToSentry(c.env.SENTRY_DSN, err, { traceId, path: c.req.path }).catch(() => { });
  }

  return c.json(
    {
      type: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
      trace_id: traceId,
    },
    500,
  );
};

// ── 4. Graceful shutdown (Cloudflare Workers) ──────────────────────────────────

/**
 * No Cloudflare Workers não existe SIGTERM clássico.
 * O equivalente é usar `ctx.waitUntil()` para garantir que operações
 * pendentes (ex: flush de logs, notificação de shutdown) terminam
 * antes do isolado ser destruído.
 *
 * Uso: export default { fetch: withGracefulShutdown(app.fetch) }
 */
export function withGracefulShutdown(
  fetchFn: (req: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>,
): (req: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (req: Request, env: Env, ctx: ExecutionContext) => {
    const responsePromise = Promise.resolve(fetchFn(req, env, ctx));
    ctx.waitUntil(responsePromise.catch(() => {}));
    return responsePromise;
  };
}

// ── Helpers internos ───────────────────────────────────────────────────────────

const PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // email
  /\bpassword[^"']*["'][^"']{4,}["']/gi, // password=...
  /\btoken[^"']*["'][^"']{8,}["']/gi, // token=...
];

function redactPii(msg: string): string {
  let result = msg;
  for (const p of PII_PATTERNS) {
    result = result.replace(p, "[REDACTED]");
  }
  return result;
}

/**
 * Envia um erro para o Sentry usando fetch nativa (sem SDK pesado).
 * Usa envelope format mínimo para Cloudflare Workers.
 */
async function captureToSentry(
  dsn: string,
  err: Error,
  ctx: { traceId: string; path: string },
): Promise<void> {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const key = url.username;
    const sentryUrl = `https://${url.host}/api/${projectId}/envelope/`;

    const eventId = crypto.randomUUID().replace(/-/g, "");
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: eventId,
        level: "error",
        platform: "node",
        exception: {
          values: [{ type: err.name, value: err.message, stacktrace: { frames: [] } }],
        },
        tags: { trace_id: ctx.traceId, path: ctx.path },
        timestamp: new Date().toISOString(),
      }),
    ].join("\n");

    await fetch(sentryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: envelope,
    });
  } catch {
    // silently ignore — nunca falhar o pedido principal por causa do Sentry
  }
}
