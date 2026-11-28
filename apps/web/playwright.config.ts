import { defineConfig, devices } from "@playwright/test";
import { PROJECT_REF_PRODUCAO, verificarBancoE2E } from "./e2e-infra/guarda-banco";

// E00-S31 (SEC-006): a suíte E2E roda SÓ contra Supabase local com seed fictício.
// - Não lê `.env.local` (que aponta para produção). O ambiente vem de
//   `e2e-infra/rodar-e2e-local.sh`, que lê `supabase status` e aplica `e2e-infra/seed-e2e.sql`.
// - `verificarBancoE2E` lança ao carregar este arquivo se a URL/chave for de produção: o
//   Playwright aborta antes do dev server e do primeiro teste.
// - O dev server é próprio (porta dedicada, nunca reaproveitado): um `pnpm dev` já aberto
//   apontando para produção não pode ser reutilizado por engano.
// - O Chromium não resolve o host de produção (cinto extra caso algo escape da trava).
// Como rodar: apps/web/e2e-infra/README.md.
verificarBancoE2E({
  url: process.env.VITE_SUPABASE_URL,
  chaveAnon: process.env.VITE_SUPABASE_ANON_KEY,
  refsPermitidos: process.env.E2E_SUPABASE_REFS_PERMITIDOS,
});

process.env.SUPABASE_TEST_EMAIL ??= "e2e-superadmin@sinergica.invalid";
process.env.SUPABASE_TEST_PASSWORD ??= "e2e-local-somente";

const PORTA = Number(process.env.E2E_PORTA ?? 5179);
const BASE_URL = `http://127.0.0.1:${PORTA}`;

export default defineConfig({
  testDir: "./e2e",
  // Specs com fixture própria e config isolada (playwright.s1NN-isolado.config.ts): exigem
  // variáveis da fixture e lançam na coleta sem elas. Rodam só pela config deles.
  testIgnore: [
    /calendario-contratual\.spec\.ts/,
    /capacidades-sso\.spec\.ts/,
    /estrutura-tecnica\.spec\.ts/,
    /plano-manutencao\.spec\.ts/,
  ],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [`--host-resolver-rules=MAP ${PROJECT_REF_PRODUCAO}.supabase.co ~NOTFOUND`],
    },
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORTA} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    // Variáveis do processo têm prioridade sobre os arquivos .env que o Vite lê (envDir = raiz).
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL as string,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY as string,
    },
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
