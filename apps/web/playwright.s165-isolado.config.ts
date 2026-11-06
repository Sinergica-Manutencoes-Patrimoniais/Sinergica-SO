import { defineConfig, devices } from "@playwright/test";

// Somente com aplicação e banco sintéticos previamente preparados em rede isolada.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /plano-manutencao\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
});
