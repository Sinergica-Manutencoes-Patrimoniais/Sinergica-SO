#!/usr/bin/env node
// E00-S16 AC-1 — nenhum window.confirm/alert/prompt sobrevive (o produto confirma/avisa dentro
// da própria interface, não com a caixa cinza do sistema operacional).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
// nav-guard-context.tsx: window.confirm síncrono de "formulário sujo, sair mesmo assim?" —
// migração pra ConfirmDialog assíncrono exige rota real (react-router useBlocker), ainda não
// implementada (E00-S21). Documentado em specs/E00-S21-rotas-wayfinding/design.md.
const IGNORAR_CAMINHO = /app\/nav-guard-context\.tsx$/;

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

const PADRAO = /\b(?:window\.)?(confirm|alert|prompt)\s*\(/g;

let violacoes = [];
for (const dir of RAIZ) {
  for (const caminho of arquivos(dir)) {
    if (IGNORAR_CAMINHO.test(caminho)) continue;
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      PADRAO.lastIndex = 0;
      const m = PADRAO.exec(linha);
      if (m) violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, trecho: m[0] });
    });
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-dialogos-nativos: 0 confirm()/alert()/prompt() nativo.");
  process.exit(0);
}
console.error(`✗ check-dialogos-nativos: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}: ${v.trecho}`);
process.exit(1);
