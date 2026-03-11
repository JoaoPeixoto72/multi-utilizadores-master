/**
 * lib/logger.ts — Logger JSON estruturado com trace_id
 *
 * R: STACK_LOCK.md §17 — JSON estruturado, zero PII, zero console.log
 * R: R01 — zero console.log no código
 *
 * Uso:
 *   import { createLogger } from './logger'
 *   const log = createLogger('auth')
 *   log.info({ user_id }, 'login_success')   // sem PII!
 *   log.error({ err }, 'db_query_failed')
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (meta: Record<string, unknown>, msg: string) => void;
  info: (meta: Record<string, unknown>, msg: string) => void;
  warn: (meta: Record<string, unknown>, msg: string) => void;
  error: (meta: Record<string, unknown>, msg: string) => void;
}

function log(
  level: LogLevel,
  context: string,
  traceId: string,
  meta: Record<string, unknown>,
  msg: string,
): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    context,
    trace_id: traceId,
    msg,
    ...meta,
  });
  // Workers: usar console.log apenas no logger estruturado — nunca directamente no código da app
  console.log(entry); // eslint-disable-line -- único uso permitido (structured logger)
}

export function createLogger(context: string, traceId?: string): Logger {
  const tid = traceId ?? crypto.randomUUID();
  return {
    debug: (meta, msg) => log("debug", context, tid, meta, msg),
    info: (meta, msg) => log("info", context, tid, meta, msg),
    warn: (meta, msg) => log("warn", context, tid, meta, msg),
    error: (meta, msg) => log("error", context, tid, meta, msg),
  };
}

/**
 * Extrair trace_id de um Request (header X-Trace-Id ou gerar novo)
 */
export function getTraceId(req: Request): string {
  return req.headers.get("x-trace-id") ?? crypto.randomUUID();
}
