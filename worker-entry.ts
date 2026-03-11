/**
 * worker-entry.ts — Entry point customizado para o Cloudflare Worker
 *
 * R: STACK_LOCK.md §4 — integração SvelteKit + Hono + Durable Objects
 *
 * O adapter-cloudflare gera .svelte-kit/cloudflare/_worker.js como default export.
 * Este ficheiro define o RateLimiter DO diretamente para que o wrangler o reconheça,
 * e re-exporta o worker SvelteKit gerado pelo build.
 *
 * Referência: https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
 */

// ── Durable Object: RateLimiter ───────────────────────────────────────────────
// Definido aqui diretamente para que o wrangler detect o export estáticamente.
// A lógica real está em apps/api/src/lib/rate-limiter-do.ts (mantida em sync).

interface RateLimitState {
  count: number;
  windowEnd: number;
}

export class RateLimiter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const body = await request.json<{ max: number; window: number }>();
    const { max, window: windowSecs } = body;

    const now = Math.floor(Date.now() / 1000);
    const stored = await this.state.storage.get<RateLimitState>("rl");
    const current = stored ?? { count: 0, windowEnd: now + windowSecs };

    if (now > current.windowEnd) {
      current.count = 0;
      current.windowEnd = now + windowSecs;
    }

    current.count++;
    await this.state.storage.put("rl", current);

    const allowed = current.count <= max;
    const retryAfter = allowed ? undefined : current.windowEnd - now;

    return new Response(JSON.stringify({ allowed, retryAfter }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── SvelteKit Worker (gerado pelo adapter-cloudflare) ─────────────────────────
export { default } from "./.svelte-kit/cloudflare/_worker.js";
