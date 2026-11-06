import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Não carrega .env.local nem reaproveita servidor já aberto.
const endpoint = process.env.S166_SUPABASE_URL;
if (!endpoint) throw new Error("Defina S166_SUPABASE_URL para o gateway isolado.");
const url = new URL(endpoint);
if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
  throw new Error("S166_SUPABASE_URL deve ser http://127.0.0.1:<porta>/, sem credenciais.");
}
const chave = process.env.S166_SUPABASE_ANON_KEY;
if (!chave) throw new Error("Defina S166_SUPABASE_ANON_KEY sintética.");
const envDir = mkdtempSync(join(tmpdir(), "sso-s166-vite-"));
process.on("exit", () => rmSync(envDir, { recursive: true, force: true }));
const env = Object.fromEntries(Object.entries(process.env).filter(([k, v]) => v !== undefined && ["PATH", "HOME", "TMPDIR", "SHELL", "SYSTEMROOT"].includes(k))) as Record<string, string>;
Object.assign(env, { S166_ENV_DIR: envDir, VITE_SUPABASE_URL: url.origin, VITE_SUPABASE_ANON_KEY: chave,
  VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED: "true", VITE_SSO_REGISTRAR_OCORRENCIA_GRUPO_ENABLED: "true", VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED: "true" });
export default defineConfig({ testDir: "./e2e/s166-isolado", fullyParallel: false, workers: 1, retries: 0, reporter: [["list"]], timeout: 30_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5189", trace: "off", screenshot: "off", serviceWorkers: "block" },
  webServer: { command: "node ./e2e/s166-isolado/servidor.mjs", url: "http://127.0.0.1:5189", reuseExistingServer: false, timeout: 60_000, env },
});
