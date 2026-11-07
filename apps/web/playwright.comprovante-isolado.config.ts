import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Este roteiro nunca utiliza o .env.local de produção ou sessão real.
export default defineConfig({
  testDir: "./e2e-isolado",
  testMatch: "comprovante.spec.ts",
  outputDir: mkdtempSync(join(tmpdir(), "sso-comprovante-playwright-")),
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5189" },
  webServer: {
    command:
      "pnpm exec vite --config vite.comprovante-isolado.config.ts --host 127.0.0.1 --port 5189 --strictPort",
    url: "http://127.0.0.1:5189",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:1",
      VITE_SUPABASE_ANON_KEY: "teste-isolado-sem-acesso",
    },
  },
});
