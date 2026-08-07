#!/usr/bin/env node
// E00-S22 AC-4 — `div`/`span` com `onClick` sem `role`+`tabIndex` (nem handler de teclado) não
// funciona pra quem navega só por teclado. Acha o fim real da tag JSX rastreando profundidade de
// `{}` — um scanner ingênuo até o primeiro `>` erra porque `=>` (arrow function) já tem um `>`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

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

// Acha a tag JSX inteira a partir de `<div`/`<span`, respeitando profundidade de `{}` — um `>`
// dentro de `{() => x}` não fecha a tag.
function fatiarTag(conteudo, inicio) {
  let i = inicio;
  let profundidade = 0;
  while (i < conteudo.length) {
    const c = conteudo[i];
    if (c === "{") profundidade += 1;
    else if (c === "}") profundidade -= 1;
    else if (c === ">" && profundidade === 0) return conteudo.slice(inicio, i + 1);
    i += 1;
  }
  return conteudo.slice(inicio, i);
}

const violacoes = [];
for (const dir of RAIZ) {
  for (const caminho of arquivos(dir)) {
    const conteudo = readFileSync(caminho, "utf8");
    const re = /<(div|span)\b/g;
    let m = re.exec(conteudo);
    while (m) {
      const tag = fatiarTag(conteudo, m.index);
      // aria-hidden="true" é exceção legítima (mesma que o biome aceita): scrim/backdrop
      // puramente decorativo pro mouse, com Esc ou outro caminho de teclado já cobrindo a ação.
      const ehDecorativo = /aria-hidden=["']true["']/.test(tag);
      if (!ehDecorativo && /\bonClick=/.test(tag) && !/\brole=/.test(tag) && !/\btabIndex=/.test(tag)) {
        const linha = conteudo.slice(0, m.index).split("\n").length;
        violacoes.push({ arquivo: relative(process.cwd(), caminho), linha });
      }
      m = re.exec(conteudo);
    }
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-div-clicavel: 0 <div>/<span> com onClick sem role+tabIndex.");
  process.exit(0);
}
console.error(`✗ check-div-clicavel: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}`);
process.exit(1);
