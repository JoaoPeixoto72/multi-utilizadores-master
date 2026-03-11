/**
 * lib/auth.ts — Hashing e verificação de passwords
 *
 * R: STACK_LOCK.md §6 — bcryptjs cost=12, Workers Paid plan obrigatório
 * R: STACK_LOCK.md §19 — proibido: bcrypt, argon2, jsonwebtoken
 * R: GS07 — zero packages de crypto proibidos
 */
import bcryptjs from "bcryptjs";

const COST_FACTOR = 12;

/**
 * Hash de password com bcryptjs cost=12
 * NOTA: requer Workers Paid plan (30 000ms CPU/req)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, COST_FACTOR);
}

/**
 * Verificação timing-safe (bcryptjs.compare — nunca usar ===)
 * R: STACK_LOCK.md §19 — comparação de hashes com === é proibida
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/**
 * Política de password: min 12 chars, 1 maiúscula, 1 minúscula, 1 especial
 * R: BUILD_PLAN.md M1.2
 */
export interface PasswordValidation {
  valid: boolean;
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  special: boolean;
}

export function validatePasswordPolicy(password: string): PasswordValidation {
  const minLength = password.length >= 12;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);

  return {
    valid: minLength && uppercase && lowercase && special,
    minLength,
    uppercase,
    lowercase,
    special,
  };
}
