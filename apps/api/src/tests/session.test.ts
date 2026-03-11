/**
 * tests/session.test.ts — Testes unitários para lib/session.ts
 *
 * R: STACK_LOCK.md §6 — HMAC-SHA-256, cookie httpOnly, uma_por_user
 * Cobertura: buildSessionCookie, extractSessionToken, signToken/verifySignedToken (via createSession/getSession)
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildSessionCookie,
  createSession,
  deleteSession,
  extractSessionToken,
  getSession,
} from "../lib/session";

// ── Mock da camada de DB ──────────────────────────────────────────────────────

const SESSION_SECRET = "a".repeat(64); // 64 hex chars conforme STACK_LOCK §6

// Mock mínimo de D1Database
function makeDb(
  overrides: Partial<{
    deleteAll: () => Promise<void>;
    create: (id: string, userId: string, token: string, expiresAt: number) => Promise<void>;
    getByToken: (token: string) => Promise<{
      id: string;
      user_id: string;
      signed_token: string;
      expires_at: number;
      created_at: number;
    } | null>;
    deleteByToken: () => Promise<void>;
  }> = {},
) {
  const store: Map<
    string,
    { id: string; user_id: string; signed_token: string; expires_at: number; created_at: number }
  > = new Map();

  const deleteAll =
    overrides.deleteAll ??
    (async () => {
      store.clear();
    });
  const create =
    overrides.create ??
    (async (id, userId, token, expiresAt) => {
      store.set(token, {
        id,
        user_id: userId,
        signed_token: token,
        expires_at: expiresAt,
        created_at: Math.floor(Date.now() / 1000),
      });
    });
  const getByToken = overrides.getByToken ?? (async (token) => store.get(token) ?? null);
  const deleteByToken =
    overrides.deleteByToken ??
    (async () => {
      store.clear();
    });

  // Simula o padrão .prepare().bind().first() / .run()
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (sql.includes("SELECT") && sql.includes("signed_token")) {
            const token = _args[0] as string;
            return await getByToken(token);
          }
          return null;
        },
        run: async () => {
          if (sql.includes("DELETE") && sql.includes("user_id")) {
            await deleteAll();
          } else if (sql.includes("INSERT")) {
            const id = _args[0] as string;
            const userId = _args[1] as string;
            const token = _args[2] as string;
            const expiresAt = _args[3] as number;
            await create(id, userId, token, expiresAt);
          } else if (sql.includes("DELETE") && sql.includes("signed_token")) {
            await deleteByToken();
          }
        },
      }),
    }),
  } as unknown as D1Database;
}

// ── buildSessionCookie ────────────────────────────────────────────────────────

describe("buildSessionCookie", () => {
  it("should return cookie with token and Max-Age=30 days", () => {
    const cookie = buildSessionCookie("my-token");
    expect(cookie).toContain("session=my-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 30}`);
  });

  it("should return clear cookie when clear=true", () => {
    const cookie = buildSessionCookie("any-token", true);
    expect(cookie).toContain("session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("should not contain token when clearing", () => {
    const cookie = buildSessionCookie("secret-token", true);
    // Cleared cookie has empty value
    expect(cookie).toMatch(/session=;/);
  });
});

// ── extractSessionToken ───────────────────────────────────────────────────────

describe("extractSessionToken", () => {
  it("should extract session token from cookie header", () => {
    const token = extractSessionToken("session=abc123; other=val");
    expect(token).toBe("abc123");
  });

  it("should extract when session is first cookie", () => {
    const token = extractSessionToken("session=tok.en.value");
    expect(token).toBe("tok.en.value");
  });

  it("should return null when session cookie is absent", () => {
    const token = extractSessionToken("other=value; another=val");
    expect(token).toBeNull();
  });

  it("should return null for null input", () => {
    const token = extractSessionToken(null);
    expect(token).toBeNull();
  });

  it("should return null for empty cookie header", () => {
    const token = extractSessionToken("");
    expect(token).toBeNull();
  });

  it("should URL-decode token values (SvelteKit encodes ':' as '%3A')", () => {
    const rawToken = "uuid-123:userid-456:1774756843.hexsig";
    const encoded = rawToken.replace(/:/g, "%3A");
    const token = extractSessionToken(`session=${encoded}; other=val`);
    expect(token).toBe(rawToken);
  });
});

// ── createSession / getSession ────────────────────────────────────────────────

describe("createSession + getSession (HMAC round-trip)", () => {
  it("should create a session and retrieve the userId", async () => {
    const db = makeDb();
    const userId = crypto.randomUUID();

    const token = await createSession(db, userId, SESSION_SECRET);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const result = await getSession(db, token, SESSION_SECRET);
    expect(result).toBe(userId);
  });

  it("should return null for tampered token", async () => {
    const db = makeDb();
    const userId = crypto.randomUUID();

    const token = await createSession(db, userId, SESSION_SECRET);
    const tampered = `${token.slice(0, -4)}dead`;

    const result = await getSession(db, tampered, SESSION_SECRET);
    expect(result).toBeNull();
  });

  it("should return null for wrong secret", async () => {
    const db = makeDb();
    const userId = crypto.randomUUID();

    const token = await createSession(db, userId, SESSION_SECRET);
    const result = await getSession(db, token, "b".repeat(64));
    expect(result).toBeNull();
  });

  it("should return null for malformed token (no dot)", async () => {
    const db = makeDb();
    const result = await getSession(db, "notavalidtoken", SESSION_SECRET);
    expect(result).toBeNull();
  });

  it("should return null when session not found in DB", async () => {
    const db = makeDb({ getByToken: async () => null });
    const userId = crypto.randomUUID();

    const token = await createSession(db, userId, SESSION_SECRET);
    // DB mock returns null — simulates missing session
    const result = await getSession(db, token, SESSION_SECRET);
    expect(result).toBeNull();
  });

  it("should return null for expired session (in DB)", async () => {
    const pastExpiry = Math.floor(Date.now() / 1000) - 1000;
    const db = makeDb({
      getByToken: async (token) => ({
        id: "sess-id",
        user_id: "user-id",
        signed_token: token,
        expires_at: pastExpiry,
        created_at: pastExpiry - 100,
      }),
    });
    const userId = crypto.randomUUID();
    const token = await createSession(db, userId, SESSION_SECRET);
    const result = await getSession(db, token, SESSION_SECRET);
    expect(result).toBeNull();
  });
});

// ── deleteSession ─────────────────────────────────────────────────────────────

describe("deleteSession", () => {
  it("should call DB delete without throwing", async () => {
    const deleteSpy = vi.fn(async () => {});
    const db = makeDb({ deleteByToken: deleteSpy });
    const userId = crypto.randomUUID();
    const token = await createSession(db, userId, SESSION_SECRET);
    await expect(deleteSession(db, token)).resolves.toBeUndefined();
  });
});
