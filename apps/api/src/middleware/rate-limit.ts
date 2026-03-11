/**
 * middleware/rate-limit.ts — Rate limiting via Durable Objects
 *
 * R: STACK_LOCK.md §6 — RATE_LIMITER Durable Object, proibido KV
 * R: BUILD_PLAN M1.3 — N tentativas, janela, duração de bloqueio
 *
 * Estratégia: cada IP tem um contador em DO.
 * Se exceder o limite → 429 com Retry-After
 */
import type { MiddlewareHandler } from "hono";
import { problemResponse } from "../lib/problem";

export interface RateLimitConfig {
  /** Número máximo de tentativas */
  maxAttempts: number;
  /** Janela em segundos */
  windowSeconds: number;
  /** Prefixo para separar contextos (ex: "login", "reset") */
  prefix?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 10,
  windowSeconds: 60,
  prefix: "global",
};

export function rateLimitMiddleware(
  config: RateLimitConfig = DEFAULT_CONFIG,
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const prefix = config.prefix ?? "global";
    const key = `${prefix}:${ip}`;

    try {
      const id = c.env.RATE_LIMITER.idFromName(key);
      const obj = c.env.RATE_LIMITER.get(id);

      const res = await obj.fetch(
        new Request("https://rate-limiter/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            max: config.maxAttempts,
            window: config.windowSeconds,
          }),
        }),
      );

      const data = await res.json<{ allowed: boolean; retryAfter?: number }>();

      if (!data.allowed) {
        const retryAfter = data.retryAfter ?? config.windowSeconds;
        c.header("Retry-After", String(retryAfter));
        return problemResponse(
          c,
          429,
          "Too Many Requests",
          `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        );
      }
    } catch {
      // Falha do DO não bloqueia o request (fail-open para evitar outage)
      // Log seria ideal aqui mas não temos contexto de env para o logger
    }

    await next();
  };
}

// Configurações pré-definidas
export const loginRateLimit = rateLimitMiddleware({
  maxAttempts: 5,
  windowSeconds: 60,
  prefix: "login",
});
export const resetRateLimit = rateLimitMiddleware({
  maxAttempts: 3,
  windowSeconds: 300,
  prefix: "reset",
});
export const apiRateLimit = rateLimitMiddleware({
  maxAttempts: 60,
  windowSeconds: 60,
  prefix: "api",
});
