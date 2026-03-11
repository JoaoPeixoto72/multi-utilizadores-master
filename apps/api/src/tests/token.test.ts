/**
 * tests/token.test.ts — Testes unitários para lib/token.ts
 *
 * R: STACK_LOCK.md §6 — token uso único, expira 1h
 * Coverage: generateOneTimeToken, hashToken, expiresIn, EXPIRY
 */
import { describe, expect, it } from "vitest";

import { EXPIRY, expiresIn, generateOneTimeToken, hashToken } from "../lib/token";

describe("generateOneTimeToken", () => {
  it("should generate raw token of 64 hex chars", async () => {
    const { raw } = await generateOneTimeToken();
    expect(raw).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(raw)).toBe(true);
  });

  it("should generate hash of 64 hex chars (SHA-256)", async () => {
    const { hash } = await generateOneTimeToken();
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("raw and hash should be different", async () => {
    const { raw, hash } = await generateOneTimeToken();
    expect(raw).not.toBe(hash);
  });

  it("should generate different tokens each call", async () => {
    const t1 = await generateOneTimeToken();
    const t2 = await generateOneTimeToken();
    expect(t1.raw).not.toBe(t2.raw);
    expect(t1.hash).not.toBe(t2.hash);
  });
});

describe("hashToken", () => {
  it("should produce same hash for same input", async () => {
    const token = "abc123def456";
    const h1 = await hashToken(token);
    const h2 = await hashToken(token);
    expect(h1).toBe(h2);
  });

  it("should produce different hash for different input", async () => {
    const h1 = await hashToken("token-one");
    const h2 = await hashToken("token-two");
    expect(h1).not.toBe(h2);
  });

  it("hash of raw token from generate should match stored hash", async () => {
    const { raw, hash } = await generateOneTimeToken();
    const recomputed = await hashToken(raw);
    expect(recomputed).toBe(hash);
  });
});

describe("expiresIn", () => {
  it("should return future unix timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    const ts = expiresIn(3600);
    expect(ts).toBeGreaterThan(now);
    expect(ts).toBeLessThanOrEqual(now + 3601); // allow 1s clock skew
  });

  it("should respect the EXPIRY constants", () => {
    expect(EXPIRY.PASSWORD_RESET).toBe(3600);
    expect(EXPIRY.INVITE).toBe(86400);
    expect(EXPIRY.BREAK_GLASS).toBe(900);
  });
});
