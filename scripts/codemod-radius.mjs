#!/usr/bin/env node
// E00-S15 AC-1 — `rounded-[Npx]` arbitrário → degrau nomeado mais próximo (sm4/md6/lg8/xl10,
// escala tirada do uso real — ver commit de E00-S14/S15). Idempotente.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.argv.includes("--dir")
  ? [process.argv[process.argv.indexOf("--dir") + 1]]
  : ["apps/web/src", "apps/portal/src"];
const SECO = process.argv.includes("--dry-run");
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

const DEGRAUS = { sm: 4, md: 6, lg: 8, xl: 10 };

function nomeMaisProximo(px) {
  let melhor = "sm";
  let melhorDist = Number.POSITIVE_INFINITY;
  for (const [nome, valor] of Object.entries(DEGRAUS)) {
    const d = Math.abs(valor - px);
    if (d < melhorDist || (d === melhorDist && valor > DEGRAUS[melhor])) {
      melhorDist = d;
      melhor = nome;
    }
  }
  return melhor;
}

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

const PADRAO = /rounded-\[(\d+)px\]/g;
let totalArquivos = 0;
let totalOcorrencias = 0;

for (const dir of raiz) {
  for (const caminho of arquivos(dir)) {
    const original = readFileSync(caminho, "utf8");
    if (!PADRAO.test(original)) continue;
    PADRAO.lastIndex = 0;
    let n = 0;
    const novo = original.replace(PADRAO, (_all, px) => {
      n += 1;
      return `rounded-${nomeMaisProximo(Number(px))}`;
    });
    if (novo !== original) {
      totalArquivos += 1;
      totalOcorrencias += n;
      if (!SECO) writeFileSync(caminho, novo, "utf8");
    }
  }
}

console.log(`${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s), ${totalOcorrencias} ocorrência(s) de rounded-[Npx] migradas.`);
