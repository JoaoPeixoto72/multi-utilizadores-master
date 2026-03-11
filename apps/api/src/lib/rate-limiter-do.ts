/**
 * lib/rate-limiter-do.ts — Durable Object para rate limiting
 *
 * R: STACK_LOCK.md §3 — RATE_LIMITER: DurableObjectNamespace
 * R: STACK_LOCK.md §6 — rate limiting via Durable Objects, proibido KV
 *
 * Este ficheiro exporta a classe RateLimiter que deve ser registada
 * no wrangler.toml como Durable Object class.
 */

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
    const body = (await request.json()) as { max: number; window: number };
    const { max, window: windowSecs } = body;

    const now = Math.floor(Date.now() / 1000);
    const stored = await this.state.storage.get<RateLimitState>("rl");
    const current = stored ?? { count: 0, windowEnd: now + windowSecs };

    // Janela expirou → reset
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
