#!/usr/bin/env node
/**
 * scripts/inject-do.mjs — Pós-build: injeta export do RateLimiter no _worker.js
 *
 * O adapter-cloudflare gera o _worker.js mas não inclui os Durable Objects
 * exportados de apps/api. Este script adiciona o export após o build.
 *
 * R: STACK_LOCK.md §4 — integração SvelteKit + Durable Objects
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = join(__dirname, "../../../.svelte-kit/cloudflare/_worker.js");

// RateLimiter DO — injetado no bundle gerado pelo adapter
const rateLimiterCode = `
// ── Durable Object: RateLimiter (injetado por scripts/inject-do.mjs) ─────────
export class RateLimiter {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const body = await request.json();
    const { max, window: windowSecs } = body;
    const now = Math.floor(Date.now() / 1000);
    const stored = await this.state.storage.get("rl");
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
`;

try {
  const worker = readFileSync(workerPath, "utf8");

  if (worker.includes("class RateLimiter")) {
    console.log("✓ RateLimiter already in _worker.js, skipping injection");
    process.exit(0);
  }

  // Insert before the final export default
  const injected = worker.replace(
    /^export \{/m,
    `${rateLimiterCode}\nexport {`,
  );

  writeFileSync(workerPath, injected);
  console.log("✓ RateLimiter injected into _worker.js");
} catch (e) {
  console.error("✗ Failed to inject RateLimiter:", e.message);
  process.exit(1);
}
