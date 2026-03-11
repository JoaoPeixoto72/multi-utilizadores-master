/**
 * tests/security-headers.test.ts — Testes para middleware/security-headers.ts (M14)
 *
 * R: BUILD_PLAN.md §M14 — G20: security headers verificáveis via curl -sI
 */
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "../middleware/security-headers";

function makeApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", securityHeaders);
  app.get("/", (c) => c.text("ok"));
  return app;
}

const mockEnv = {} as unknown as Env;
const mockCtx = {} as ExecutionContext;

describe("securityHeaders middleware", () => {
  it("should set X-Frame-Options: DENY", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("should set X-Content-Type-Options: nosniff", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("should set Strict-Transport-Security", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    const hsts = res.headers.get("strict-transport-security");
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
  });

  it("should set Content-Security-Policy with frame-ancestors none", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("should set Referrer-Policy", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("should set Permissions-Policy", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    const pp = res.headers.get("permissions-policy");
    expect(pp).toBeTruthy();
    expect(pp).toContain("camera=()");
    expect(pp).toContain("geolocation=()");
  });

  it("should set all 5 required security headers", async () => {
    const app = makeApp();
    const res = await app.fetch(new Request("http://localhost/"), mockEnv, mockCtx);
    const required = [
      "x-frame-options",
      "x-content-type-options",
      "strict-transport-security",
      "content-security-policy",
      "referrer-policy",
    ];
    for (const header of required) {
      expect(res.headers.get(header), `Missing header: ${header}`).toBeTruthy();
    }
  });
});
