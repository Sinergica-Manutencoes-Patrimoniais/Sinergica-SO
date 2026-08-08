#!/usr/bin/env node
// E00-S17 AC-5 — codemod: `...` (ASCII, prosa) → `…` (U+2026). Mesmo padrão do gate — nunca
// toca spread/rest (`...props`, `...(expr)`).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const SECO = process.argv.includes("--dry-run");
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

let totalArquivos = 0;
let totalOcorrencias = 0;
for (const dir of RAIZ) {
  for (const caminho of arquivos(dir)) {
    const original = readFileSync(caminho, "utf8");
    const contagem = (original.match(PADRAO) || []).length;
    if (contagem === 0) continue;
    const novo = original.replace(PADRAO, "…");
    totalArquivos += 1;
    totalOcorrencias += contagem;
    if (!SECO) writeFileSync(caminho, novo, "utf8");
  }
}
console.log(`${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s), ${totalOcorrencias} ocorrência(s) de '...' migradas para '…'.`);
