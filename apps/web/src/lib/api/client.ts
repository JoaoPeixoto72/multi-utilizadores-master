/**
 * api/client.ts — Cliente RPC tipado (Hono client)
 *
 * R: STACK_LOCK.md §4 — cliente_rpc
 * R: M08 — ZERO fetch() directo no frontend (G_M08)
 *
 * Uso:
 *   import { api } from '$lib/api/client'
 *   const res = await api.auth.login.$post({ json: { email, password } })
 */
import { hc } from "hono/client";
import type { AppType } from "$api/index";

// Instância singleton do cliente RPC tipado
// Use relative API path in the browser to hit the local dev proxy at /api
export const api = hc<AppType>("/api");

export type ApiClient = typeof api;
