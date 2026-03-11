import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      exclude: [
        "node_modules/**",
        ".svelte-kit/**",
        "apps/web/src/paraglide/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
    },
  },
});
