#!/usr/bin/env node
// E00-S16 AC-5 — erro de operação nunca desaparece em silêncio. `catch {}` vazio ou que só tem
// `console.*` dentro de pages/components é o padrão exato do bug real corrigido em
// ConversaChat.tsx (2026-08-07): áudio/mídia falhava como promise rejeitada sem feedback nenhum.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src/features/*/pages", "apps/web/src/features/*/components"];
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

function expandirGlobsSimples() {
  const base = "apps/web/src/features";
  let dominios;
  try {
    dominios = readdirSync(base);
  } catch {
    return [];
  }
  const out = [];
  for (const dominio of dominios) {
    for (const sub of ["pages", "components"]) {
      out.push(join(base, dominio, sub));
    }
  }
  return out;
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
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) out = out.concat(arquivos(caminho));
    else if (/\.tsx?$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) out.push(caminho);
  }
  return out;
}

function corposCatch(conteudo) {
  const corpos = [];
  const re = /\bcatch\s*(\([^)]*\))?\s*\{/g;
  let m = re.exec(conteudo);
  while (m) {
    const inicio = m.index + m[0].length;
    let profundidade = 1;
    let i = inicio;
    while (i < conteudo.length && profundidade > 0) {
      if (conteudo[i] === "{") profundidade += 1;
      else if (conteudo[i] === "}") profundidade -= 1;
      i += 1;
    }
    const corpo = conteudo.slice(inicio, i - 1);
    const linha = conteudo.slice(0, m.index).split("\n").length;
    corpos.push({ corpo, linha });
    m = re.exec(conteudo);
  }
  return corpos;
}

function eSilencioso(corpo) {
  const temComentario = /\/\/.*\S|\/\*[\s\S]*?\*\//.test(corpo);
  const semComentario = corpo.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const semConsole = semComentario.replace(/console\.[a-z]+\([^;]*\);?/g, "").trim();
  if (semConsole !== "") return false; // tem código real além de console.* — não é silencioso
  // Só sobrou console.*/nada. Comentário explicando a escolha é aceito como decisão deliberada
  // (ex.: polling em background onde a próxima rodada já corrige) — sem comentário, é smell.
  return !temComentario;
}

const violacoes = [];
for (const dir of expandirGlobsSimples()) {
  for (const caminho of arquivos(dir)) {
    const conteudo = readFileSync(caminho, "utf8");
    for (const { corpo, linha } of corposCatch(conteudo)) {
      if (eSilencioso(corpo)) {
        violacoes.push({ arquivo: relative(process.cwd(), caminho), linha });
      }
    }
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-catch-silencioso: 0 catch vazio/só-console em pages/components.");
  process.exit(0);
}
console.error(`✗ check-catch-silencioso: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}: catch sem feedback ao usuário`);
process.exit(1);
