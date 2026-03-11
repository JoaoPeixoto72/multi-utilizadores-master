/**
 * tests/auth.test.ts — Testes unitários para lib/auth.ts
 *
 * R: STACK_LOCK.md §6 — bcryptjs cost=12
 * R: BUILD_PLAN M1.2 — política de password
 * Coverage: hashPassword, verifyPassword, validatePasswordPolicy
 */
import { describe, expect, it } from "vitest";

import { hashPassword, validatePasswordPolicy, verifyPassword } from "../lib/auth";

describe("validatePasswordPolicy", () => {
  it("should reject passwords shorter than 12 chars", () => {
    const result = validatePasswordPolicy("Short1!");
    expect(result.valid).toBe(false);
    expect(result.minLength).toBe(false);
  });

  it("should reject passwords without uppercase", () => {
    const result = validatePasswordPolicy("alllowercase123!");
    expect(result.valid).toBe(false);
    expect(result.uppercase).toBe(false);
  });

  it("should reject passwords without lowercase", () => {
    const result = validatePasswordPolicy("ALLUPPERCASE123!");
    expect(result.valid).toBe(false);
    expect(result.lowercase).toBe(false);
  });

  it("should reject passwords without special character", () => {
    const result = validatePasswordPolicy("NoSpecialChar123");
    expect(result.valid).toBe(false);
    expect(result.special).toBe(false);
  });

  it("should accept a valid password", () => {
    const result = validatePasswordPolicy("ValidPass123!");
    expect(result.valid).toBe(true);
    expect(result.minLength).toBe(true);
    expect(result.uppercase).toBe(true);
    expect(result.lowercase).toBe(true);
    expect(result.special).toBe(true);
  });

  it("should accept password with various special characters", () => {
    const passwords = ["MyPassword123@", "SecureP4ss#word", "P4ssw0rd$here!", "Test.Pass1234"];
    for (const pw of passwords) {
      expect(validatePasswordPolicy(pw).valid).toBe(true);
    }
  });

  it("should reject exactly 11 characters", () => {
    expect(validatePasswordPolicy("Short1!Xyzw").valid).toBe(false);
  });

  it("should accept exactly 12 characters", () => {
    expect(validatePasswordPolicy("Exactly12Ch!").valid).toBe(true);
  });
});

describe("hashPassword + verifyPassword", () => {
  it("should hash a password and verify it", async () => {
    const password = "ValidPass123!";
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  it("should reject wrong password", async () => {
    const hash = await hashPassword("CorrectPass123!");
    const valid = await verifyPassword("WrongPass123!", hash);
    expect(valid).toBe(false);
  });

  it("should produce different hashes for the same password (salt)", async () => {
    const password = "SamePass123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2); // salts differ
  });
}, 30_000); // bcryptjs cost=12 pode demorar até 30s por teste
