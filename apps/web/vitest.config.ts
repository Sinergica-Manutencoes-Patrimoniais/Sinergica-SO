import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // e2e/ é Playwright (specs .spec.ts contra Supabase de produção) — nunca vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/main.tsx", "src/app/**"],
      // Cobertura é gate de qualidade quando rodada com --coverage; o gate de CI usa `vitest run`.
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
