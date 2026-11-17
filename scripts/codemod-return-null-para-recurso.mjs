#!/usr/bin/env node
// E00-S28 — segunda parte do codemod: troca `if (!flagLigada("X")) return null;` (gate de
// componente inteiro, condição única, já convertido para `flagLigada` pela primeira passada —
// `codemod-flags-registro.mjs`) por `RecursoNaoAtivado`. Só toca a forma canônica — quem combina
// a flag com outra condição (`|| algumaCoisa`) fica de fora e precisa de leitura humana (a
// combinação normalmente mistura "contexto errado" com "desativado", que são coisas diferentes —
// ver AC-F1 das specs e o padrão usado em CriarOsChamado/GestaoEscopo/etc. no Lote 1).
//
// `podeAdministrar` nasce fixo em `false` nos componentes tocados por este codemod — de
// propósito: para threading de verdade (ler `user.papel` e repassar como prop) seria preciso
// tocar a assinatura da função E todo ponto de chamada, caso a caso; nem toda árvore de props
// tem acesso a `user.papel` (ver origem-campo/levantamentos — chamados pela 4ª ou 5ª camada só com
// `userId: string`). `false` é o lado seguro: nunca vaza nome de flag/gate, nunca quebra caller
// existente, zero mudança de assinatura ou tipo. Fecha a AC-3 (nunca mais `return null`
// silencioso) em escala; a AC-4 completa (admin vê o que falta) fica como pendência documentada,
// componente a componente, não escondida.
//
// Uso:
//   node scripts/codemod-return-null-para-recurso.mjs --dry-run [--dir <caminho>]
//   node scripts/codemod-return-null-para-recurso.mjs [--dir <caminho>]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results", ".turbo"]);
// Só a forma pura — uma linha, uma condição, nada de `||`/`&&` com outra coisa.
const RX_GATE_PURO = /^([ \t]*)if\s*\(\s*!flagLigada\(\s*"([A-Z0-9_]+)"\s*\)\s*\)\s*return null;\s*$/;

let dadosRegistro = null;
function carregarRegistro() {
  if (!dadosRegistro) {
    dadosRegistro = JSON.parse(readFileSync("apps/web/src/config/flags-sso.data.json", "utf8"));
  }
  return dadosRegistro;
}

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
    else if (/\.tsx$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(caminho);
  }
  return out;
}

function caminhoRelativo(arquivo, alvo) {
  const raizSrc = "apps/web/src";
  const idx = arquivo.indexOf(raizSrc);
  const depoisDeSrc = idx >= 0 ? arquivo.slice(idx + raizSrc.length) : arquivo;
  const profundidade = depoisDeSrc.split("/").filter(Boolean).length - 1;
  const prefixo = profundidade <= 0 ? "./" : "../".repeat(profundidade);
  return `${prefixo}${alvo}`;
}

function descricaoDaFlag(nome) {
  const registro = carregarRegistro();
  return registro.find((e) => e.nome === nome) ?? null;
}

export function transformar(conteudo, caminhoDoArquivo) {
  const linhas = conteudo.split("\n");
  let alterouAlgo = false;
  const flagsUsadas = new Set();

  for (let i = 0; i < linhas.length; i++) {
    const m = RX_GATE_PURO.exec(linhas[i]);
    if (!m) continue;
    const [, indent, nomeFlag] = m;
    const entrada = descricaoDaFlag(nomeFlag);
    if (!entrada) continue; // flag desconhecida — não assume nada, pula
    flagsUsadas.add(nomeFlag);
    const faltandoExpr = entrada.gate
      ? `["${nomeFlag}", "${entrada.gate}"]`
      : `["${nomeFlag}"]`;
    linhas[i] =
      `${indent}if (!flagLigada("${nomeFlag}")) {\n` +
      `${indent}  return (\n` +
      `${indent}    <RecursoNaoAtivado\n` +
      `${indent}      recurso="${entrada.descricao.replace(/"/g, '\\"')}"\n` +
      `${indent}      podeAdministrar={false}\n` +
      `${indent}      faltando={${faltandoExpr}}\n` +
      `${indent}    />\n` +
      `${indent}  );\n` +
      `${indent}}`;
    alterouAlgo = true;
  }

  if (!alterouAlgo) return { conteudo, alterado: false };

  let novo = linhas.join("\n");

  // Garante os imports: RecursoNaoAtivado de @sinergica/ui.
  if (!/import\s*\{[^}]*\bRecursoNaoAtivado\b[^}]*\}\s*from\s*["']@sinergica\/ui["']/.test(novo)) {
    const linhasNovo = novo.split("\n");
    const rxUiImport = /from\s+["']@sinergica\/ui["']/;
    let idx = linhasNovo.findIndex((l) => rxUiImport.test(l));
    if (idx >= 0) {
      linhasNovo[idx] = linhasNovo[idx].replace(/\{([^}]*)\}/, (_m, miolo) => {
        const nomes = miolo
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!nomes.includes("RecursoNaoAtivado")) nomes.push("RecursoNaoAtivado");
        nomes.sort();
        return `{ ${nomes.join(", ")} }`;
      });
    } else {
      let ultimoImport = -1;
      let dentro = false;
      for (let i = 0; i < linhasNovo.length; i++) {
        if (!dentro) {
          if (/^import\b/.test(linhasNovo[i])) dentro = true;
          else continue;
        }
        if (/;\s*$/.test(linhasNovo[i])) {
          ultimoImport = i;
          dentro = false;
        }
      }
      const linha = `import { RecursoNaoAtivado } from "@sinergica/ui";`;
      if (ultimoImport >= 0) linhasNovo.splice(ultimoImport + 1, 0, linha);
      else linhasNovo.unshift(linha, "");
    }
    novo = linhasNovo.join("\n");
  }

  return { conteudo: novo, alterado: true, flagsUsadas };
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const dirArg = argv.includes("--dir") ? argv[argv.indexOf("--dir") + 1] : null;
  const raiz = dirArg ?? "apps/web/src";

  let tocados = 0;
  for (const caminho of arquivosFonte(raiz)) {
    const original = readFileSync(caminho, "utf8");
    if (!original.includes("flagLigada")) continue; // atalho — todo gate candidato já usa flagLigada
    const { conteudo, alterado } = transformar(original, caminho);
    if (!alterado) continue;
    tocados++;
    console.log(`${dryRun ? "[dry-run] " : ""}${relative(process.cwd(), caminho)}`);
    if (!dryRun) writeFileSync(caminho, conteudo);
  }
  console.log(`\n${tocados} arquivo(s) ${dryRun ? "seriam alterados" : "alterados"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
