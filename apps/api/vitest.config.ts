/**
 * vitest.config.ts — Configuração de testes para apps/api
 *
 * R: STACK_LOCK.md §15 — coverage ≥ 70%
 * Usa environment node para acesso a SubtleCrypto (via Web Crypto API do Node 20+)
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/db/**", "src/middleware/**"],
      exclude: ["src/tests/**", "**/*.d.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
