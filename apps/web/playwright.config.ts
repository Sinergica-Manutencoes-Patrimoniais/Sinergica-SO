import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// ATENÇÃO: dev server local, mas Supabase é o de PRODUÇÃO (VITE_SUPABASE_URL do .env.local raiz —
// não há Supabase local/staging neste projeto). Specs em e2e/ criam dados reais prefixados
// "[TESTE E2E]" e limpam o que dá para limpar pela própria UI (nem toda entidade tem exclusão —
// ver notas nos specs). Requer SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD (usuário real) no
// .env.local — sem isso, `auth.setup.ts` falha rápido com mensagem clara.
const __dirname = dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(resolve(__dirname, "../../.env.local"));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
