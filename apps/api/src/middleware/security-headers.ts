/**
 * middleware/security-headers.ts — Security Headers (M14)
 *
 * R: BUILD_PLAN.md §M14 — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
 *    Referrer-Policy, Permissions-Policy
 * R: STACK_LOCK.md §14 — security headers via middleware
 * R: G20 — verificável via `curl -sI`
 *
 * Aplicados em TODAS as respostas via app.use("*", securityHeaders).
 */

import type { MiddlewareHandler } from "hono";

/**
 * CSP directivas:
 * - default-src 'self': bloqueia recursos externos por defeito
 * - script-src 'self': apenas scripts do mesmo origin (sem inline, sem CDN externo)
 * - style-src 'self' 'unsafe-inline': inline styles permitidos (Svelte/Tailwind)
 * - img-src 'self' data: blob:: imagens locais + data URIs (avatars)
 * - font-src 'self': fontes apenas do mesmo origin
 * - connect-src 'self': fetch/XHR apenas para o mesmo origin
 * - frame-ancestors 'none': bloqueia embedding (clickjacking)
 * - base-uri 'self': previne ataques de base-tag injection
 * - form-action 'self': forms só submetem para o mesmo origin
 * - upgrade-insecure-requests: força HTTPS
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  const h = c.res.headers;

  // Previne clickjacking (redundante com frame-ancestors mas compatível com IE)
  h.set("X-Frame-Options", "DENY");

  // Previne MIME type sniffing
  h.set("X-Content-Type-Options", "nosniff");

  // Política de referrer conservadora
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS: 1 ano, inclui subdomains
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Content Security Policy
  h.set("Content-Security-Policy", CSP_DIRECTIVES);

  // Permissions Policy — desabilita funcionalidades de browser não usadas
  h.set(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "accelerometer=()",
      "gyroscope=()",
    ].join(", "),
  );

  // Remove header que expõe tecnologia usada
  h.delete("X-Powered-By");
};
