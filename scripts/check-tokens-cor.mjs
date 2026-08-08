#!/usr/bin/env node
// E00-S14 — gate: nenhum hex cru sobrevive em classe utilitária de JSX (spec AC-2).
// Roda em apps/web/src e apps/portal/src. Ignora geração de PDF (pdf-lib usa rgb(), não CSS),
// teste (auto-referência) e o allowlist explícito abaixo (cor dinâmica escolhida pelo usuário,
// não token de design).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = process.argv.includes("--dir")
  ? [process.argv[process.argv.indexOf("--dir") + 1]]
  : ["apps/web/src", "apps/portal/src"];

const IGNORAR_DIR = new Set(["node_modules", "dist", "lib/pdf", "test-results"]);
// .ts também — funções de domínio (ex.: `statusOsColor`) devolvem string de classe com hex,
// não só `.tsx` (gap real encontrado em ordens-servico.ts/inspecoes-laudos.ts/pmoc.ts).
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;

// arquivo:linha (aproximado por trecho único) → motivo. Cor dinâmica escolhida pelo usuário
// (marcação de cliente), não é token de design — não faz sentido codemodar.
const ALLOWLIST_TRECHO = ['cliente.marcacao?.cor ?? "#9CA3AF"'];

const PADRAO_HEX_CLASSE =
  /\b(?:dark:)?(?:bg|text|border|ring|from|to|via|outline|fill|stroke|divide|decoration|caret|accent|shadow)-\[#[0-9A-Fa-f]{3,8}\]/g;
const PADRAO_BG_WHITE = /\bbg-white\b/g;
const PADRAO_TEXT_BLACK = /\btext-black\b/g;

function arquivosTsx(dir) {
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
    if (info.isDirectory()) {
      out = out.concat(arquivosTsx(caminho));
    } else if (/\.tsx?$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) {
      out.push(caminho);
    }
  }
  return out;
}

let violacoes = [];
for (const dir of raiz) {
  for (const caminho of arquivosTsx(dir)) {
    const conteudo = readFileSync(caminho, "utf8");
    if (ALLOWLIST_TRECHO.some((trecho) => conteudo.includes(trecho))) {
      // ainda assim precisa verificar o resto do arquivo — remove só o trecho permitido da busca
    }
    const linhas = conteudo.split("\n");
    linhas.forEach((linha, i) => {
      if (ALLOWLIST_TRECHO.some((trecho) => linha.includes(trecho))) return;
      for (const padrao of [PADRAO_HEX_CLASSE, PADRAO_BG_WHITE, PADRAO_TEXT_BLACK]) {
        padrao.lastIndex = 0;
        let m = padrao.exec(linha);
        while (m) {
          violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, trecho: m[0] });
          m = padrao.exec(linha);
        }
      }
    });
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-tokens-cor: 0 hex cru / bg-white / text-black em classe utilitária.");
  process.exit(0);
}

console.error(`✗ check-tokens-cor: ${violacoes.length} ocorrência(s) fora dos tokens semânticos.\n`);
const porArquivo = new Map();
for (const v of violacoes) {
  if (!porArquivo.has(v.arquivo)) porArquivo.set(v.arquivo, []);
  porArquivo.get(v.arquivo).push(v);
}
for (const [arquivo, lista] of porArquivo) {
  console.error(`  ${arquivo}`);
  for (const v of lista.slice(0, 5)) console.error(`    ${v.linha}: ${v.trecho}`);
  if (lista.length > 5) console.error(`    … +${lista.length - 5}`);
}
process.exit(1);
