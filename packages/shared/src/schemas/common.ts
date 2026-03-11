/**
 * schemas/common.ts — Schemas Zod comuns
 *
 * R: STACK_LOCK.md §7 — ids: lower(hex(randomblob(16)))
 */
import { z } from "zod";

// ID hexadecimal de 32 caracteres (16 bytes)
export const HexIdSchema = z
  .string()
  .length(32)
  .regex(/^[0-9a-f]+$/);

// Email
export const EmailSchema = z.string().email().toLowerCase().trim();

// Password — política: min 12 chars, 1 maiúscula, 1 minúscula, 1 especial
export const PasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Timestamp Unix (INTEGER na D1)
export const UnixTimestampSchema = z.number().int().positive();
