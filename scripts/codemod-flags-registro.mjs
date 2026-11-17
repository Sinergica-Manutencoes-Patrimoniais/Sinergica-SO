#!/usr/bin/env node
// E00-S28 task 7 — migra leitura direta de `import.meta.env.VITE_SSO_*` para `flagLigada(...)`
// do registro (`apps/web/src/config/flags-sso.ts`). Mecânico e idempotente: só toca os dois
// padrões seguros (comparação explícita com "true"); não toca passagem de flag como prop
// (`habilitado={import.meta.env.X}`) nem expressão condicional complexa — essas exigem leitura
// humana (ver docs/Apontamentos/alcance-no-front-2026-11-17.md, "outro"/"propHabilitado").
//
// Uso:
//   node scripts/codemod-flags-registro.mjs --dry-run [--dir <caminho>]   # só mostra o diff
//   node scripts/codemod-flags-registro.mjs [--dir <caminho>]             # aplica
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results", ".turbo"]);
const RX_IGUAL_TRUE = /import\.meta\.env\.(VITE_SSO_[A-Z0-9_]+)\s*===\s*"true"/g;
const RX_DIFERENTE_TRUE = /import\.meta\.env\.(VITE_SSO_[A-Z0-9_]+)\s*!==\s*"true"/g;
const RX_IMPORT_FLAGS = /from\s+["']([^"']*config\/flags-sso)["']/;

function arquivosFonte(dir) {
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
    if (info.isDirectory()) out = out.concat(arquivosFonte(caminho));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(caminho);
  }
  return out;
}

function caminhoRelativoParaFlags(arquivo) {
  // apps/web/src/config/flags-sso.ts — calcula o relativo a partir do diretório do arquivo.
  const raizSrc = "apps/web/src";
  const idx = arquivo.indexOf(raizSrc);
  const depoisDeSrc = idx >= 0 ? arquivo.slice(idx + raizSrc.length) : arquivo;
  const profundidade = depoisDeSrc.split("/").filter(Boolean).length - 1; // -1: não conta o arquivo
  const prefixo = profundidade <= 0 ? "./" : "../".repeat(profundidade);
  return `${prefixo}config/flags-sso`;
}

export function transformar(conteudo, caminhoDoArquivo) {
  let alterado = false;
  let novo = conteudo.replace(RX_IGUAL_TRUE, (_m, nome) => {
    alterado = true;
    return `flagLigada("${nome}")`;
  });
  novo = novo.replace(RX_DIFERENTE_TRUE, (_m, nome) => {
    alterado = true;
    return `!flagLigada("${nome}")`;
  });
  if (!alterado) return { conteudo, alterado: false };

  const jaImportaFlagLigada = /import\s*\{[^}]*\bflagLigada\b[^}]*\}\s*from\s*["'][^"']*config\/flags-sso["']/.test(novo);
  if (!jaImportaFlagLigada) {
    // garante o import — se já existir uma linha de import de flags-sso, funde; senão, cria uma.
    const linhas = novo.split("\n");
    let idxImportExistente = -1;
    for (let i = 0; i < linhas.length; i++) {
      if (RX_IMPORT_FLAGS.test(linhas[i])) {
        idxImportExistente = i;
        break;
      }
    }
    if (idxImportExistente >= 0) {
      const linha = linhas[idxImportExistente];
      if (!/\bflagLigada\b/.test(linha)) {
        linhas[idxImportExistente] = linha.replace(/\{([^}]*)\}/, (_m, miolo) => {
          const nomes = miolo
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (!nomes.includes("flagLigada")) nomes.push("flagLigada");
          nomes.sort();
          return `{ ${nomes.join(", ")} }`;
        });
      }
    } else {
      // Insere depois do ÚLTIMO import de topo. `import` pode ser multilinha
      // (`import {\n  a,\n  b,\n} from "x";`) — uma máquina de estado simples acompanha "estou
      // dentro de um import ainda não fechado" e só marca `ultimoImport` quando a linha que fecha
      // o `;` é vista, nunca na primeira linha de um bloco multilinha.
      let ultimoImport = -1;
      let dentroDeImport = false;
      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        if (!dentroDeImport) {
          if (/^import\b/.test(linha)) dentroDeImport = true;
          else continue;
        }
        if (/;\s*$/.test(linha)) {
          ultimoImport = i;
          dentroDeImport = false;
        }
      }
      const relFlags = caminhoRelativoParaFlags(caminhoDoArquivo);
      const novaLinha = `import { flagLigada } from "${relFlags}";`;
      if (ultimoImport >= 0) linhas.splice(ultimoImport + 1, 0, novaLinha);
      else linhas.unshift(novaLinha, "");
    }
    novo = linhas.join("\n");
  }
  return { conteudo: novo, alterado: true };
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const dirArg = argv.includes("--dir") ? argv[argv.indexOf("--dir") + 1] : null;
  const raiz = dirArg ?? "apps/web/src";

  let tocados = 0;
  let ocorrencias = 0;
  for (const caminho of arquivosFonte(raiz)) {
    if (caminho.endsWith("config/flags-sso.ts")) continue;
    const original = readFileSync(caminho, "utf8");
    const antesA = (original.match(RX_IGUAL_TRUE) ?? []).length;
    const antesB = (original.match(RX_DIFERENTE_TRUE) ?? []).length;
    if (antesA + antesB === 0) continue;
    const { conteudo, alterado } = transformar(original, caminho);
    if (!alterado) continue;
    tocados++;
    ocorrencias += antesA + antesB;
    console.log(`${dryRun ? "[dry-run] " : ""}${relative(process.cwd(), caminho)} (${antesA + antesB} ocorrência(s))`);
    if (!dryRun) writeFileSync(caminho, conteudo);
  }
  console.log(`\n${tocados} arquivo(s), ${ocorrencias} ocorrência(s) ${dryRun ? "seriam alteradas" : "alteradas"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
