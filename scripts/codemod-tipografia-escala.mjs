#!/usr/bin/env node
// E00-S18 AC-1/AC-5 — rollout da escala nomeada nos usos que têm correspondência EXATA de
// tamanho com um degrau já declarado em `index.css` (não é "valor mais próximo", é troca de
// nome com aparência pixel-idêntica, mesmo princípio do codemod de cor da E00-S14):
//   text-xs (12px)   → text-caption  (0.75rem = 12px)
//   text-sm (14px)   → text-body     (0.875rem = 14px)
//   text-base (16px) → text-heading  (1rem = 16px)
//   text-xl (20px)   → text-title    (1.25rem = 20px)
// text-lg/2xl/3xl NÃO têm correspondência exata na escala de 7 degraus — ficam de fora
// deliberadamente (trocar por aproximação mudaria a aparência, o que a spec proíbe).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVOS_EXTRA = ["apps/web/src/index.css"];
const RAIZ = ["apps/web/src", "apps/portal/src", "packages/ui/src"];
const SECO = process.argv.includes("--dry-run");
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

const MAPA = {
  xs: "caption",
  sm: "body",
  base: "heading",
  xl: "title",
};
const PADRAO = /\btext-(xs|sm|base|xl)\b/g;

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
    else if (/\.(tsx?|css)$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) out.push(caminho);
  }
  return out;
}

const alvos = [...RAIZ.flatMap((dir) => arquivos(dir)), ...ARQUIVOS_EXTRA];

let totalArquivos = 0;
let totalOcorrencias = 0;
for (const caminho of alvos) {
  const original = readFileSync(caminho, "utf8");
  const contagem = (original.match(PADRAO) || []).length;
  if (contagem === 0) continue;
  const novo = original.replace(PADRAO, (_match, grau) => `text-${MAPA[grau]}`);
  totalArquivos += 1;
  totalOcorrencias += contagem;
  if (!SECO) writeFileSync(caminho, novo, "utf8");
}
console.log(
  `${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s), ${totalOcorrencias} ocorrência(s) de text-xs/sm/base/xl migradas para a escala nomeada.`,
);
