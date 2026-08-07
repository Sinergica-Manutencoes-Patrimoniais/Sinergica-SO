#!/usr/bin/env node
// E00-S17 AC-5 — reticência única no produto (U+2026 `…`, nunca `...` ASCII). O padrão exclui
// spread/rest (`...props`, `...(expr)`) por não seguir letra/`_`/`$`/`(` — só pega prosa.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
const PADRAO = /\.\.\.(?![A-Za-z_$(])/g;

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
      if (PADRAO.test(linha)) {
        violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1 });
      }
    });
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-reticencia: 0 '...' ASCII em texto de UI (fora de spread/rest).");
  process.exit(0);
}
console.error(`✗ check-reticencia: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes.slice(0, 20)) console.error(`  ${v.arquivo}:${v.linha}`);
if (violacoes.length > 20) console.error(`  … +${violacoes.length - 20}`);
process.exit(1);
