#!/usr/bin/env node
// Gate de produção (E02-S42) — nasce do incidente em que a rota `/preview-s41` (dado SIMULADO,
// criada no porte Evolution para demo) foi parar no bundle de produção servido em
// so-sinergica.netlify.app, confirmado por string literal no JS entregue (reanálise do Fabrício,
// 12/11/2026, pergunta 24).
//
// Builda o app com `vite build` (produção real, sem --mode development) e falha se qualquer
// string marcadora de prévia simulada sobreviver no bundle — não confia só no tree-shaking do
// `import.meta.env.DEV`, prova de verdade.
//
// Uso: node scripts/check-sem-previa-em-producao.mjs
// Sai com código 1 se achar qualquer marcador no dist/.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const WEB_DIR = "apps/web";
const DIST_DIR = join(WEB_DIR, "dist");

// Qualquer rota/componente de prévia com dado simulado deve ser listado aqui — é a lista que
// prova FR-003 (falha se alguém reintroduzir o padrão sem passar por este gate).
const MARCADORES_DE_PREVIA = ["preview-s41", "PreviewVisualS41", "dado mock, sem backend"];

function buildarProducao() {
  console.log("Buildando apps/web em modo produção…");
  execSync("npx vite build", { cwd: WEB_DIR, stdio: "inherit" });
}

function arquivosJsDoDist(dir) {
  const resultado = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) resultado.push(...arquivosJsDoDist(caminho));
    else if (entrada.name.endsWith(".js")) resultado.push(caminho);
  }
  return resultado;
}

function main() {
  if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true, force: true });
  buildarProducao();

  if (!existsSync(DIST_DIR)) {
    console.error("✗ check-sem-previa-em-producao: build não gerou dist/ — algo falhou antes.");
    process.exit(1);
  }

  const arquivos = arquivosJsDoDist(DIST_DIR);
  const achados = [];
  for (const arquivo of arquivos) {
    const conteudo = readFileSync(arquivo, "utf8");
    for (const marcador of MARCADORES_DE_PREVIA) {
      if (conteudo.includes(marcador)) achados.push({ arquivo, marcador });
    }
  }

  rmSync(DIST_DIR, { recursive: true, force: true });

  if (achados.length > 0) {
    console.error(`✗ check-sem-previa-em-producao: ${achados.length} marcador(es) de prévia simulada no bundle de produção:`);
    for (const { arquivo, marcador } of achados) {
      console.error(`  - "${marcador}" em ${arquivo}`);
    }
    console.error("\nGate a prevenir: E02-S42 (reanálise do Fabrício, 12/11/2026, pergunta 24).");
    process.exit(1);
  }

  console.log(`✓ check-sem-previa-em-producao: nenhum marcador de prévia simulada no bundle de produção (${arquivos.length} arquivo(s) JS verificado(s)).`);
}

main();
