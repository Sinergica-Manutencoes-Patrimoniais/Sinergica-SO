import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Falha fechada: nunca carrega .env nem aceita outro projeto ou URL.
const dir = "/Users/lucasazevedo/sso-comprovantes-AmwvLX";
let status: { API_URL: string; ANON_KEY: string };
try {
  const texto = execFileSync(
    "rtk",
    ["proxy", "supabase", "status", "--workdir", dir, "-o", "json"],
    {
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        DOCKER_CONFIG: "/tmp/sinergica-codex-docker-no-config",
        DOCKER_HOST: "unix:///Users/lucasazevedo/.colima/default/docker.sock",
      },
    },
  );
  status = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
} catch {
  throw new Error("Pilha sso-comprovantes-isolado indisponível; teste real não executado.");
}
if (status.API_URL !== "http://127.0.0.1:56321" || !status.ANON_KEY) {
  throw new Error("URL da pilha isolada inválida; teste real não executado.");
}

export default defineConfig({
  testDir: "./e2e-isolado",
  testMatch: "comprovante-real.spec.ts",
  outputDir: mkdtempSync(join(tmpdir(), "sso-comprovante-real-")),
  reporter: "list",
  workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5189" },
  webServer: {
    command:
      "pnpm exec vite --config vite.comprovante-isolado.config.ts --host 127.0.0.1 --port 5189 --strictPort",
    url: "http://127.0.0.1:5189",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_ANON_KEY: status.ANON_KEY },
  },
});
