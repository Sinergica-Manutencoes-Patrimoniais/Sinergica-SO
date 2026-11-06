import { defineConfig, devices } from "@playwright/test";

// Usa somente o aplicativo e o Supabase sintéticos do clone descartável.
const appUrl = process.env.SSO_S176_APP_URL;
if (!appUrl) throw new Error("Defina SSO_S176_APP_URL para o proxy sintético.");
const app = new URL(appUrl);
if (app.protocol !== "http:" || app.hostname !== "127.0.0.1" || app.port !== "5189" || app.username || app.password || app.search || app.hash) {
  throw new Error("SSO_S176_APP_URL deve apontar para o proxy local isolado.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: /estrutura-tecnica\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: app.origin, serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
});
