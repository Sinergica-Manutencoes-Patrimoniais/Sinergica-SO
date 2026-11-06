import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-isolado",
  testMatch: "xlsx.spec.ts",
  outputDir: mkdtempSync(join(tmpdir(), "sso-xlsx-playwright-")),
  reporter: "list",
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:56473" },
  webServer: {
    command: "pnpm exec vite --config vite.comprovante-isolado.config.ts --host 127.0.0.1 --port 56473 --strictPort",
    url: "http://127.0.0.1:56473",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_SUPABASE_URL: "http://127.0.0.1:1", VITE_SUPABASE_ANON_KEY: "teste-isolado-sem-acesso", VITE_SSO_PREVIA_XLSX_ENABLED: "true" },
  },
});
