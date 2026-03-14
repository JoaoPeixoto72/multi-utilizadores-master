/**
 * tests/middleware.test.ts — Testes unitários para middleware/auth.ts e middleware/csrf.ts
 *
 * R: STACK_LOCK.md §5,§6 — auth guard, CSRF validação, RFC 7807
 * Cobertura: authMiddleware (sem token, token inválido, user não encontrado, sucesso)
 *            csrfMiddleware (sem header, header inválido, método GET, sucesso)
 */

import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { generateCsrfToken } from "../lib/csrf";
import type { AuthUser } from "../middleware/auth.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const CSRF_SECRET = "a".repeat(64);
const SESSION_SECRET = "b".repeat(64);

// Mock DB factory
function makeDb(
  options: {
    session?: {
      id: string;
      user_id: string;
      signed_token: string;
      expires_at: number;
      created_at: number;
    } | null;
    user?: { id: string; email: string; created_at: number; updated_at: number } | null;
  } = {},
) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (sql.includes("sessions") || sql.includes("signed_token")) {
            return options.session ?? null;
          }
          if (sql.includes("users") && sql.includes("SELECT id, email,")) {
            return options.user ?? null;
          }
          return null;
        },
        run: async () => {},
      }),
    }),
  } as unknown as D1Database;
}

// Build a minimal Env for middleware tests
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: (overrides.DB ?? makeDb()) as D1Database,
    CSRF_SECRET: overrides.CSRF_SECRET ?? CSRF_SECRET,
    SESSION_SECRET: overrides.SESSION_SECRET ?? SESSION_SECRET,
    RATE_LIMITER: (overrides.RATE_LIMITER ?? ({} as DurableObjectNamespace)) as DurableObjectNamespace,
    R2_BUCKET: (overrides.R2_BUCKET ?? ({} as R2Bucket)) as R2Bucket,
    ENCRYPTION_KEY: overrides.ENCRYPTION_KEY ?? "c".repeat(64),
    CF_ACCOUNT_ID: overrides.CF_ACCOUNT_ID ?? "acc",
    CF_API_TOKEN: overrides.CF_API_TOKEN ?? "tok",
    APP_ENV: overrides.APP_ENV ?? "test",
    APP_URL: overrides.APP_URL ?? "http://localhost:5173",
    API_URL: overrides.API_URL ?? "http://127.0.0.1:8787",
    SENTRY_DSN: overrides.SENTRY_DSN,
  };
}

// ── authMiddleware ────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  // Build a test app with the auth middleware
  async function buildApp(envOverride: Partial<Env> = {}) {
    const { authMiddleware } = await import("../middleware/auth");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", (c, next) => {
      // Inject env into context
      Object.assign(c.env ?? {}, makeEnv(envOverride));
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      (c as any).env = makeEnv(envOverride);
      return next();
    });
    app.use("*", authMiddleware as MiddlewareHandler);
    app.get("/protected", (c) => c.json({ user: c.get("user") }));
    return app;
  }

  it("should return 401 when no session cookie", async () => {
    const app = await buildApp();
    const res = await app.request("http://localhost/protected");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Authentication Required");
  });

  it("should return 401 for invalid/expired session token", async () => {
    const app = await buildApp({
      DB: makeDb({ session: null }),
    });
    const res = await app.request("http://localhost/protected", {
      headers: { cookie: "session=invalid-token-xyz" },
    });
    expect(res.status).toBe(401);
  });

  it("should return 401 when session exists but user not found", async () => {
    // We need a valid signed token — create one via session lib
    const { createSession } = await import("../lib/session");
    const userId = crypto.randomUUID();
    const validSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      signed_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Generate a real signed token
    const dbForCreate = makeDb();
    const token = await createSession(dbForCreate, userId, SESSION_SECRET);
    validSession.signed_token = token;

    const app = await buildApp({
      DB: makeDb({ session: { ...validSession, signed_token: token }, user: null }),
    });

    const res = await app.request("http://localhost/protected", {
      headers: { cookie: `session=${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("should pass and set user in context when session is valid", async () => {
    const { createSession } = await import("../lib/session");
    const userId = crypto.randomUUID();
    const dbForCreate = makeDb();
    const token = await createSession(dbForCreate, userId, SESSION_SECRET);

    const validSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      signed_token: token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      created_at: Math.floor(Date.now() / 1000),
    };

    const validUser = {
      id: userId,
      email: "test@example.com",
      role: "super_user" as const,
      tenant_id: null,
      is_owner: 0,
      is_temp_owner: 0,
      status: "active" as const,
      created_at: 0,
      updated_at: 0,
    };

    const app = await buildApp({
      DB: makeDb({ session: validSession, user: validUser }),
    });

    const res = await app.request("http://localhost/protected", {
      headers: { cookie: `session=${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string; email: string } };
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe("test@example.com");
  });
});

// ── csrfMiddleware ────────────────────────────────────────────────────────────

describe("csrfMiddleware", () => {
  async function buildCsrfApp() {
    const { csrfMiddleware } = await import("../middleware/csrf");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      (c as any).env = makeEnv();
      return next();
    });
    app.use("*", csrfMiddleware as MiddlewareHandler);
    app.post("/mutate", (c) => c.json({ ok: true }));
    app.get("/read", (c) => c.json({ ok: true }));
    return app;
  }

  it("should pass GET requests without CSRF header", async () => {
    const app = await buildCsrfApp();
    const res = await app.request("http://localhost/read");
    expect(res.status).toBe(200);
  });

  it("should block POST without CSRF header (403)", async () => {
    const app = await buildCsrfApp();
    const res = await app.request("http://localhost/mutate", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("CSRF Token Missing");
  });

  it("should block POST with invalid CSRF token (403)", async () => {
    const app = await buildCsrfApp();
    const res = await app.request("http://localhost/mutate", {
      method: "POST",
      headers: { "x-csrf-token": "invalid.token.here" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("CSRF Token Invalid");
  });

  it("should allow POST with valid CSRF token", async () => {
    const app = await buildCsrfApp();
    const validToken = await generateCsrfToken(CSRF_SECRET);
    const res = await app.request("http://localhost/mutate", {
      method: "POST",
      headers: { "x-csrf-token": validToken },
    });
    expect(res.status).toBe(200);
  });

  it("should block DELETE without CSRF header", async () => {
    const _app = await buildCsrfApp();
    const appWithDelete = new Hono<{ Bindings: Env }>();
    const { csrfMiddleware } = await import("../middleware/csrf");
    appWithDelete.use("*", (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      (c as any).env = makeEnv();
      return next();
    });
    appWithDelete.use("*", csrfMiddleware as MiddlewareHandler);
    appWithDelete.delete("/item", (c) => c.json({ deleted: true }));

    const res = await appWithDelete.request("http://localhost/item", { method: "DELETE" });
    expect(res.status).toBe(403);
  });

  it("should block PATCH without CSRF header", async () => {
    const _app = await buildCsrfApp();
    const appWithPatch = new Hono<{ Bindings: Env }>();
    const { csrfMiddleware } = await import("../middleware/csrf");
    appWithPatch.use("*", (c, next) => {
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      (c as any).env = makeEnv();
      return next();
    });
    appWithPatch.use("*", csrfMiddleware as MiddlewareHandler);
    appWithPatch.patch("/item", (c) => c.json({ updated: true }));

    const res = await appWithPatch.request("http://localhost/item", { method: "PATCH" });
    expect(res.status).toBe(403);
  });
});

// ── requireSuperUser ───────────────────────────────────────────────────────────

describe("requireSuperUser", () => {
  async function buildGuardApp(userOverride: Record<string, unknown>) {
    const { requireSuperUser } = await import("../middleware/auth.js");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", (c, next) => {
      const u: AuthUser = {
        id: "u1",
        email: "test@t.com",
        role: "collaborator",
        tenant_id: null,
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        ...userOverride,
      } as AuthUser;
      c.set("user", u);
      return next();
    });
    app.get("/super", requireSuperUser, (c) => c.json({ ok: true }));
    return app;
  }

  it("should return 403 for non-super_user", async () => {
    const app = await buildGuardApp({ role: "collaborator" });
    const res = await app.request("http://localhost/super");
    expect(res.status).toBe(403);
  });

  it("should return 200 for super_user", async () => {
    const app = await buildGuardApp({ role: "super_user" });
    const res = await app.request("http://localhost/super");
    expect(res.status).toBe(200);
  });
});

// ── requireOwner ───────────────────────────────────────────────────────────────

describe("requireOwner", () => {
  async function buildOwnerApp(userOverride: Record<string, unknown>) {
    const { requireOwner } = await import("../middleware/auth.js");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", (c, next) => {
      const u: AuthUser = {
        id: "u1",
        email: "t@t.com",
        role: "collaborator",
        tenant_id: "t1",
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        ...userOverride,
      } as AuthUser;
      c.set("user", u);
      return next();
    });
    app.get("/owner", requireOwner, (c) => c.json({ ok: true }));
    return app;
  }

  it("should return 403 for regular collaborator", async () => {
    const app = await buildOwnerApp({ is_owner: 0, is_temp_owner: 0 });
    const res = await app.request("http://localhost/owner");
    expect(res.status).toBe(403);
  });

  it("should return 200 for fixed owner", async () => {
    const app = await buildOwnerApp({ is_owner: 1, is_temp_owner: 0 });
    const res = await app.request("http://localhost/owner");
    expect(res.status).toBe(200);
  });

  it("should return 200 for temp owner (member role)", async () => {
    const app = await buildOwnerApp({ role: "member", is_owner: 0, is_temp_owner: 1 });
    const res = await app.request("http://localhost/owner");
    expect(res.status).toBe(200);
  });
});

// ── requireAdmin ───────────────────────────────────────────────────────────────

describe("requireAdmin", () => {
  async function buildAdminApp(userOverride: Record<string, unknown>) {
    const { requireAdmin } = await import("../middleware/auth.js");
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", (c, next) => {
      const u: AuthUser = {
        id: "u1",
        email: "t@t.com",
        role: "collaborator",
        tenant_id: "t1",
        is_owner: 0,
        is_temp_owner: 0,
        status: "active",
        ...userOverride,
      } as AuthUser;
      c.set("user", u);
      return next();
    });
    app.get("/admin", requireAdmin, (c) => c.json({ ok: true }));
    return app;
  }

  it("should return 403 for collaborator without elevated role", async () => {
    const app = await buildAdminApp({ role: "collaborator", is_owner: 0, is_temp_owner: 0 });
    const res = await app.request("http://localhost/admin");
    expect(res.status).toBe(403);
  });

  it("should return 200 for super_user", async () => {
    const app = await buildAdminApp({ role: "super_user" });
    const res = await app.request("http://localhost/admin");
    expect(res.status).toBe(200);
  });

  it("should return 200 for tenant_admin", async () => {
    const app = await buildAdminApp({ role: "tenant_admin" });
    const res = await app.request("http://localhost/admin");
    expect(res.status).toBe(200);
  });

  it("should return 200 for is_owner=1", async () => {
    const app = await buildAdminApp({ role: "member", is_owner: 1 });
    const res = await app.request("http://localhost/admin");
    expect(res.status).toBe(200);
  });
});
