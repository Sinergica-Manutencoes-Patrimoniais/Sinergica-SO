#!/usr/bin/env node
// E00-S18 AC-4 — 0 `text-[Npx]` arbitrário (só degrau nomeado da escala: display/title/heading/
// body/body-sm/caption/micro, ou a escala padrão do Tailwind).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
const PADRAO = /text-\[\d+px\]/g;

function arquivos(dir) {
  let out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const nome of entradas) {
    if (IGNORAR_DIR.has(nome)) continue;
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) out = out.concat(arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) out.push(caminho);
  }
  return out;
}

let violacoes = [];
for (const dir of RAIZ) {
  for (const caminho of arquivos(dir)) {
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      PADRAO.lastIndex = 0;
      const m = PADRAO.exec(linha);
      if (m) violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, trecho: m[0] });
    });
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-tipografia: 0 text-[Npx] arbitrário.");
  process.exit(0);
}
console.error(`✗ check-tipografia: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}: ${v.trecho}`);
process.exit(1);
