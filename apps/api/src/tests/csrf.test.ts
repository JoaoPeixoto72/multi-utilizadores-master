/**
 * tests/csrf.test.ts — Testes unitários para lib/csrf.ts
 *
 * R: STACK_LOCK.md §6 — HMAC-SHA-256, expiração 1h
 * Coverage: generateCsrfToken, verifyCsrfToken
 */
import { describe, expect, it } from "vitest";

import { generateCsrfToken, verifyCsrfToken } from "../lib/csrf";

const TEST_SECRET = "a".repeat(64); // 64 hex chars simulando CSRF_SECRET

describe("generateCsrfToken", () => {
  it("should return a non-empty string", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("should produce different tokens each call", async () => {
    const t1 = await generateCsrfToken(TEST_SECRET);
    const t2 = await generateCsrfToken(TEST_SECRET);
    expect(t1).not.toBe(t2);
  });

  it("should contain two dots (payload.uuid.signature)", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    const parts = token.split(".");
    // format: timestamp.uuid.hexsig
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });
});

describe("verifyCsrfToken", () => {
  it("should verify a freshly generated token", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    const valid = await verifyCsrfToken(token, TEST_SECRET);
    expect(valid).toBe(true);
  });

  it("should reject a tampered token", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    const tampered = `${token.slice(0, -4)}0000`;
    const valid = await verifyCsrfToken(tampered, TEST_SECRET);
    expect(valid).toBe(false);
  });

  it("should reject a token signed with a different secret", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    const otherSec = "b".repeat(64);
    const valid = await verifyCsrfToken(token, otherSec);
    expect(valid).toBe(false);
  });

  it("should reject an expired token", async () => {
    const token = await generateCsrfToken(TEST_SECRET);
    // maxAge = 0ms → immediate expiry
    const valid = await verifyCsrfToken(token, TEST_SECRET, 0);
    expect(valid).toBe(false);
  });

  it("should reject malformed tokens", async () => {
    for (const bad of ["", "notadot", "a.b"]) {
      const valid = await verifyCsrfToken(bad, TEST_SECRET);
      expect(valid).toBe(false);
    }
  });
});
