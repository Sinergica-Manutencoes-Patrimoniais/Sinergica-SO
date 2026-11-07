import { defineConfig, devices } from "@playwright/test";

// Usa o proxy estático e o Supabase sintético iniciados pelo bootstrap isolado.
const appUrl = process.env.SSO_S166_APP_URL;
if (!appUrl) throw new Error("Defina SSO_S166_APP_URL para o proxy sintético.");
const app = new URL(appUrl);
if (app.protocol !== "http:" || app.hostname !== "127.0.0.1" || app.port !== "5189" || app.username || app.password || app.search || app.hash) {
  throw new Error("SSO_S166_APP_URL deve apontar para o proxy local isolado.");
}
export default defineConfig({
  testDir: "./e2e",
  testMatch: /calendario-contratual\.spec\.ts/,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: app.origin, serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
});
