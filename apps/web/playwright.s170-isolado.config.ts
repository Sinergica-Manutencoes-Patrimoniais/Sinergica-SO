import { defineConfig, devices } from "@playwright/test";

// Usa somente o aplicativo e o Supabase sintéticos do clone descartável.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /capacidades-sso\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
});
