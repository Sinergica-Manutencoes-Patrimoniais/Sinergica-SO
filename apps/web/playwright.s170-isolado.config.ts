import { defineConfig, devices } from "@playwright/test";

// Executar somente com aplicação e Supabase sintéticos já iniciados em loopback.
// Não carrega .env.local nem usa o auth.setup ou servidor do projeto padrão.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /capacidades-sso\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], trace: "off", screenshot: "off", video: "off", serviceWorkers: "block" },
});
