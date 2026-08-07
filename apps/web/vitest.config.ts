import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ é Playwright (specs .spec.ts contra Supabase de produção) — nunca vitest.
    // Componente que precisa de DOM real declara `// @vitest-environment jsdom` no topo do
    // arquivo (Vitest troca o ambiente por arquivo) — mantém o resto da suíte em "node", rápido.
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
