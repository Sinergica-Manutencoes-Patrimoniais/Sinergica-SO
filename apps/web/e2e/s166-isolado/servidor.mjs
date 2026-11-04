import { spawn } from "node:child_process";
// Playwright mescla env com o processo pai. Remover explicitamente variáveis não autorizadas.
const permitidas = new Set(["PATH", "HOME", "TMPDIR", "SHELL", "SYSTEMROOT", "S166_ENV_DIR", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED", "VITE_SSO_REGISTRAR_OCORRENCIA_GRUPO_ENABLED", "VITE_SSO_CONFIRMAR_FILA_PREVENTIVA_ENABLED"]);
const env = Object.fromEntries(Object.entries(process.env).filter(([nome]) => permitidas.has(nome)));
const servidor = spawn("pnpm", ["exec", "vite", "--config", "vite.s166-isolado.config.ts", "--host", "127.0.0.1", "--port", "5189", "--strictPort"], { env, stdio: "inherit" });
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => servidor.kill(sinal));
servidor.on("error", (erro) => { console.error(erro.message); process.exitCode = 1; });
servidor.on("exit", (codigo) => { process.exitCode = codigo ?? 1; });
