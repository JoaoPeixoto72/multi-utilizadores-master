/**
 * src/worker.ts — Custom Cloudflare Worker entry point
 *
 * R: STACK_LOCK.md §4 — worker entry, Durable Objects re-export
 * Necessário para que o wrangler reconheça o RateLimiter DO exportado
 * pelo apps/api. O adapter-cloudflare usa este ficheiro como entry point
 * quando configurado com `customWorkerEntryPoint`.
 */

// Re-export Durable Object para que o wrangler.toml o reconheça
export { RateLimiter } from "../api/src/lib/rate-limiter-do";

// Re-export o worker SvelteKit default (gerado pelo adapter)
export { default } from "./entry.cloudflare";
