#!/usr/bin/env node
// E00-S20 AC-2 — sombra default do Tailwind (preto puro) e a duplicação manual do token
// "raised" → os 4 degraus nomeados (raised/overlay/modal/drawer), derivados do navy.
// Não toca `shadow-[..._#hex]` decorativo (não é elevação de superfície — ex.: borda inferior
// de botão "pressionado") nem qualquer `shadow-[...]` que não bata num padrão conhecido.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const SECO = process.argv.includes("--dry-run");
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

const NOMEADO = {
  "shadow-sm": "shadow-raised",
  "shadow-lg": "shadow-overlay",
  "shadow-xl": "shadow-modal",
  "shadow-2xl": "shadow-drawer",
};

// Arbitrário conhecido → token (valor exato, hand-written antes de existir o token).
const ARBITRARIO = {
  "shadow-[0_1px_2px_rgba(20,28,54,0.035)]": "shadow-raised",
  "shadow-[0_1px_2px_rgba(20,28,54,0.03)]": "shadow-raised",
  "shadow-[0_1px_2px_rgba(20,28,54,0.04)]": "shadow-raised",
  "shadow-[0_10px_26px_rgba(20,28,54,0.08)]": "shadow-overlay",
};

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
    let conteudo = readFileSync(caminho, "utf8");
    const original = conteudo;
    let n = 0;

    for (const [de, para] of Object.entries(NOMEADO)) {
      const re = new RegExp(`\\b${de}\\b`, "g");
      conteudo = conteudo.replace(re, () => {
        n += 1;
        return para;
      });
    }
    for (const [de, para] of Object.entries(ARBITRARIO)) {
      const partes = conteudo.split(de);
      if (partes.length > 1) {
        n += partes.length - 1;
        conteudo = partes.join(para);
      }
    }

    if (conteudo !== original) {
      totalArquivos += 1;
      totalOcorrencias += n;
      if (!SECO) writeFileSync(caminho, conteudo, "utf8");
    }
  }
}

console.log(`${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s), ${totalOcorrencias} ocorrência(s) de sombra migradas.`);
