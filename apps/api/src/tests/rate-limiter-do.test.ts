/**
 * tests/rate-limiter-do.test.ts — Testes unitários para lib/rate-limiter-do.ts
 *
 * R: STACK_LOCK.md §6 — rate limiting via Durable Object
 * Testa a lógica interna do RateLimiter sem o ambiente DO completo
 */
import { beforeEach, describe, expect, it } from "vitest";
import { RateLimiter } from "../lib/rate-limiter-do";

// ── Mock DurableObjectState ───────────────────────────────────────────────────

class MockStorage {
  private store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}

function makeState(): DurableObjectState {
  return { storage: new MockStorage() } as unknown as DurableObjectState;
}

function makeRequest(max: number, windowSeconds: number): Request {
  return new Request("http://do-internal/", {
    method: "POST",
    body: JSON.stringify({ max, window: windowSeconds }),
    headers: { "Content-Type": "application/json" },
  });
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("RateLimiter Durable Object", () => {
  let state: DurableObjectState;

  beforeEach(() => {
    state = makeState();
  });

  it("should allow first request", async () => {
    const rl = new RateLimiter(state);
    const res = await rl.fetch(makeRequest(5, 60));
    const body = (await res.json()) as { allowed: boolean; retryAfter?: number };
    expect(body.allowed).toBe(true);
  });

  it("should allow requests within limit", async () => {
    const rl = new RateLimiter(state);
    for (let i = 0; i < 5; i++) {
      const res = await rl.fetch(makeRequest(5, 60));
      const body = (await res.json()) as { allowed: boolean };
      expect(body.allowed).toBe(true);
    }
  });

  it("should block when limit is exceeded", async () => {
    const rl = new RateLimiter(state);

    // Consume all 5 allowed requests
    for (let i = 0; i < 5; i++) {
      await rl.fetch(makeRequest(5, 60));
    }

    // 6th request should be blocked
    const res = await rl.fetch(makeRequest(5, 60));
    const body = (await res.json()) as { allowed: boolean; retryAfter?: number };
    expect(body.allowed).toBe(false);
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("should reset after window expiry", async () => {
    const rl = new RateLimiter(state);

    // Exhaust limit
    for (let i = 0; i < 3; i++) {
      await rl.fetch(makeRequest(3, 60));
    }

    // Manually expire the window by overwriting stored state to past
    const pastWindowEnd = Math.floor(Date.now() / 1000) - 100;
    await state.storage.put("rl", { count: 3, windowEnd: pastWindowEnd });

    // Now should be allowed again (new window opens)
    const res = await rl.fetch(makeRequest(3, 60));
    const body = (await res.json()) as { allowed: boolean };
    expect(body.allowed).toBe(true);
  });

  it("should return JSON response with allowed and retryAfter fields", async () => {
    const rl = new RateLimiter(state);
    const res = await rl.fetch(makeRequest(10, 60));
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as { allowed: boolean; retryAfter?: number };
    expect(typeof body.allowed).toBe("boolean");
  });

  it("should not have retryAfter when allowed", async () => {
    const rl = new RateLimiter(state);
    const res = await rl.fetch(makeRequest(10, 60));
    const body = (await res.json()) as { allowed: boolean; retryAfter?: number };
    expect(body.allowed).toBe(true);
    // retryAfter is undefined when allowed
    expect(body.retryAfter).toBeUndefined();
  });

  it("should allow limit=1 exactly once", async () => {
    const rl = new RateLimiter(state);

    const r1 = await rl.fetch(makeRequest(1, 60));
    const b1 = (await r1.json()) as { allowed: boolean };
    expect(b1.allowed).toBe(true);

    const r2 = await rl.fetch(makeRequest(1, 60));
    const b2 = (await r2.json()) as { allowed: boolean };
    expect(b2.allowed).toBe(false);
  });
});
