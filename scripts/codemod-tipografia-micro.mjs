#!/usr/bin/env node
// E00-S18 AC-4 — `text-[9px]`/`text-[10px]`/`text-[11px]` → `text-micro` (0.6875rem = 11px).
// AC-1 exige que o menor degrau nunca fique abaixo de 11px equivalente — 9/10px sobem pra 11,
// deliberado (legibilidade), não um efeito colateral do codemod.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const SECO = process.argv.includes("--dry-run");
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
const PADRAO = /text-\[(9|10|11)px\]/g;

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
    const novo = original.replace(PADRAO, "text-micro");
    totalArquivos += 1;
    totalOcorrencias += contagem;
    if (!SECO) writeFileSync(caminho, novo, "utf8");
  }
}
console.log(`${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s), ${totalOcorrencias} ocorrência(s) de text-[9/10/11px] migradas para text-micro.`);
