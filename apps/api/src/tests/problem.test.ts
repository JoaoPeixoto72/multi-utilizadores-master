/**
 * tests/problem.test.ts — Testes unitários para lib/problem.ts
 *
 * R: STACK_LOCK.md §5, G11 — RFC 7807, zero statusCode directo
 * Cobertura: problemResponse, authErrorResponse, forbiddenResponse, validationErrorResponse
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  authErrorResponse,
  forbiddenResponse,
  problemResponse,
  validationErrorResponse,
} from "../lib/problem";

// Helper para criar um contexto Hono real a partir de uma request
function _makeContext(_app: Hono, path = "/test") {
  return new Request(`http://localhost${path}`);
}

// Helper: montar app Hono de teste e chamar rota
async function callRoute(handler: (c: import("hono").Context) => Response): Promise<Response> {
  const app = new Hono();
  app.get("/test", handler);
  return await app.request("http://localhost/test");
}

// ── problemResponse ───────────────────────────────────────────────────────────

describe("problemResponse", () => {
  it("should return 422 with RFC 7807 body", async () => {
    const res = await callRoute((c) =>
      problemResponse(c, 422, "Validation Error", "Invalid email"),
    );

    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(422);
    expect(body.title).toBe("Validation Error");
    expect(body.detail).toBe("Invalid email");
    expect(body.type).toContain("422");
  });

  it("should return 401 with correct type URL", async () => {
    const res = await callRoute((c) => problemResponse(c, 401, "Unauthorized"));

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(401);
    expect(body.type).toContain("401");
    expect(body.detail).toBeUndefined();
  });

  it("should include extra fields when provided", async () => {
    const res = await callRoute((c) =>
      problemResponse(c, 429, "Too Many Requests", "Rate limit exceeded", { retry_after: 60 }),
    );

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.retry_after).toBe(60);
    expect(body.status).toBe(429);
  });

  it("should return 404", async () => {
    const res = await callRoute((c) => problemResponse(c, 404, "Not Found"));
    expect(res.status).toBe(404);
  });

  it("should return 500", async () => {
    const res = await callRoute((c) => problemResponse(c, 500, "Internal Server Error"));
    expect(res.status).toBe(500);
  });

  it("should return 503", async () => {
    const res = await callRoute((c) =>
      problemResponse(c, 503, "Service Unavailable", "DB unreachable"),
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(503);
    expect(body.detail).toBe("DB unreachable");
  });
});

// ── authErrorResponse ─────────────────────────────────────────────────────────

describe("authErrorResponse", () => {
  it("should return 401 with generic message (no credential leak)", async () => {
    const res = await callRoute((c) => authErrorResponse(c));

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Authentication Failed");
    expect(body.detail).toBe("Invalid credentials");
    // Must not leak specific info
    expect(JSON.stringify(body)).not.toContain("email");
    expect(JSON.stringify(body)).not.toContain("password");
  });
});

// ── forbiddenResponse ─────────────────────────────────────────────────────────

describe("forbiddenResponse", () => {
  it("should return 403 with default message", async () => {
    const res = await callRoute((c) => forbiddenResponse(c));

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Forbidden");
    expect(body.detail).toBe("Insufficient permissions");
  });

  it("should include custom detail when provided", async () => {
    const res = await callRoute((c) => forbiddenResponse(c, "IDOR: tenant mismatch"));

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.detail).toBe("IDOR: tenant mismatch");
  });
});

// ── validationErrorResponse ───────────────────────────────────────────────────

describe("validationErrorResponse", () => {
  it("should return 422 with errors array", async () => {
    const errors = [
      { field: "email", message: "Invalid email format" },
      { field: "password", message: "Too short" },
    ];
    const res = await callRoute((c) => validationErrorResponse(c, errors));

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.title).toBe("Validation Error");
    expect(Array.isArray(body.errors)).toBe(true);
    expect((body.errors as typeof errors).length).toBe(2);
    expect((body.errors as typeof errors)[0]?.field).toBe("email");
  });

  it("should return 422 with empty errors array", async () => {
    const res = await callRoute((c) => validationErrorResponse(c, []));

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe(422);
    expect(Array.isArray(body.errors)).toBe(true);
  });
});
