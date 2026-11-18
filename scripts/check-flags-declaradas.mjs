#!/usr/bin/env node
// E00-S28 AC-1/AC-2 — gate: toda flag VITE_SSO_* lida no código do front precisa estar declarada
// em `apps/web/src/config/flags-sso.ts` (condição 1), e toda entrada do registro precisa ser lida
// por algum arquivo (condição 2) — registro morto também é ruído. Falha nomeia a flag e o
// arquivo:linha, não só a contagem.
//
// Cobre também a fuga do registro: leitura de `import.meta.env.VITE_SSO_*` fora do próprio
// `flags-sso.ts` (só `flagLigada` pode tocar `import.meta.env` — é a regra do arquivo) e a
// construção dinâmica (`import.meta.env[\`VITE_SSO_${x}\`]`), que escaparia das duas condições
// acima silenciosamente.
//
// Uso:
//   node scripts/check-flags-declaradas.mjs                 # repositório inteiro
//   node scripts/check-flags-declaradas.mjs --dir <caminho> # só um diretório (migração em lotes)
//   node scripts/check-flags-declaradas.mjs --inventario    # imprime flag×arquivo×jornada×gate
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REGISTRO = "apps/web/src/config/flags-sso.ts";
// E00-S28: o dado vive em flags-sso.data.json (ver nota no topo de flags-sso.ts — o array literal
// de 737 entradas direto no `.ts`, somado às funções que iteram `FLAGS_SSO`, deixou o Biome
// instável nesta máquina). `flags-sso.ts` importa via `?raw` + `JSON.parse`, então o nome da flag
// não aparece como texto literal nesse arquivo — a fonte de verdade para "declarada" é o JSON.
const REGISTRO_DADOS = "apps/web/src/config/flags-sso.data.json";
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results", ".turbo"]);
const RX_FLAG = /VITE_SSO_[A-Z0-9_]+/g;
const RX_LEITURA_DIRETA = /import\.meta\.env(?:\?\.|\.)VITE_SSO_[A-Z0-9_]+/;
const RX_LEITURA_DINAMICA = /import\.meta\.env\s*\[\s*[`'"]VITE_SSO_/;

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

// Aceita tanto o JSON de dados real (array de `{nome, ...}`) quanto, por compatibilidade com quem
// ainda chamar a função com o texto do antigo registro inline, um texto contendo `nome: '...'`.
export function extrairRegistro(conteudoRegistroOuJson) {
  const nomes = new Set();
  try {
    const dados = JSON.parse(conteudoRegistroOuJson);
    if (Array.isArray(dados)) {
      for (const entrada of dados) if (typeof entrada?.nome === "string") nomes.add(entrada.nome);
      return nomes;
    }
  } catch {
    // não é JSON — cai para o formato antigo de texto `.ts`, abaixo.
  }
  const rx = /nome:\s*'(VITE_SSO_[A-Z0-9_]+)'/g;
  let m = rx.exec(conteudoRegistroOuJson);
  while (m) {
    nomes.add(m[1]);
    m = rx.exec(conteudoRegistroOuJson);
  }
  return nomes;
}

export function varrer(raizes, caminhoRegistro = REGISTRO) {
  const lidas = new Map(); // nome -> [{arquivo, linha}]
  const fugaDoRegistro = [];
  const construcaoDinamica = [];

  for (const raiz of raizes) {
    for (const caminho of arquivosFonte(raiz)) {
      const ehORegistro = caminho === caminhoRegistro || caminho.endsWith(caminhoRegistro);
      const conteudo = readFileSync(caminho, "utf8");
      const linhas = conteudo.split("\n");
      linhas.forEach((linha, i) => {
        if (RX_LEITURA_DINAMICA.test(linha)) {
          construcaoDinamica.push({ arquivo: caminho, linha: i + 1 });
        }
        if (!ehORegistro && RX_LEITURA_DIRETA.test(linha)) {
          fugaDoRegistro.push({ arquivo: caminho, linha: i + 1, trecho: linha.trim() });
        }
        RX_FLAG.lastIndex = 0;
        let m = RX_FLAG.exec(linha);
        while (m) {
          if (!ehORegistro) {
            if (!lidas.has(m[0])) lidas.set(m[0], []);
            lidas.get(m[0]).push({ arquivo: caminho, linha: i + 1 });
          }
          m = RX_FLAG.exec(linha);
        }
      });
    }
  }
  return { lidas, fugaDoRegistro, construcaoDinamica };
}

function main() {
  const argv = process.argv.slice(2);
  const dirArg = argv.includes("--dir") ? argv[argv.indexOf("--dir") + 1] : null;
  const raizes = dirArg ? [dirArg] : ["apps/web/src"];

  const conteudoRegistro = readFileSync(REGISTRO_DADOS, "utf8");
  const declaradas = extrairRegistro(conteudoRegistro);
  const { lidas, fugaDoRegistro, construcaoDinamica } = varrer(raizes);

  if (argv.includes("--inventario")) {
    for (const nome of [...lidas.keys()].sort()) {
      const ocorrencias = lidas.get(nome);
      const estado = declaradas.has(nome) ? "declarada" : "NAO_DECLARADA";
      console.log(`${nome}\t${estado}\t${relative(process.cwd(), ocorrencias[0].arquivo)}`);
    }
    process.exit(0);
  }

  const naoDeclaradas = [...lidas.keys()].filter((nome) => !declaradas.has(nome));
  const orfas = dirArg
    ? [] // órfã só faz sentido na varredura completa — um lote não vê o resto do uso
    : [...declaradas].filter((nome) => !lidas.has(nome));

  let falhou = false;

  if (naoDeclaradas.length > 0) {
    falhou = true;
    console.error(`✗ ${naoDeclaradas.length} flag(s) lida(s) e não declarada(s) em ${REGISTRO}:\n`);
    for (const nome of naoDeclaradas) {
      const primeira = lidas.get(nome)[0];
      console.error(`  ${nome}  <- ${relative(process.cwd(), primeira.arquivo)}:${primeira.linha}`);
    }
    console.error("");
  }

  if (orfas.length > 0) {
    falhou = true;
    console.error(`✗ ${orfas.length} flag(s) declarada(s) em ${REGISTRO} e nunca lida(s):\n`);
    for (const nome of orfas) console.error(`  ${nome}`);
    console.error("");
  }

  if (fugaDoRegistro.length > 0) {
    falhou = true;
    console.error(
      `✗ ${fugaDoRegistro.length} leitura(s) direta(s) de import.meta.env.VITE_SSO_* fora de ${REGISTRO} (use flagLigada):\n`,
    );
    for (const v of fugaDoRegistro.slice(0, 20)) {
      console.error(`  ${relative(process.cwd(), v.arquivo)}:${v.linha}: ${v.trecho}`);
    }
    console.error("");
  }

  if (construcaoDinamica.length > 0) {
    falhou = true;
    console.error(`✗ ${construcaoDinamica.length} construção(ões) dinâmica(s) de flag (foge do gate):\n`);
    for (const v of construcaoDinamica) {
      console.error(`  ${relative(process.cwd(), v.arquivo)}:${v.linha}`);
    }
    console.error("");
  }

  if (!falhou) {
    console.log(`✓ check-flags-declaradas: ${lidas.size} flag(s) lida(s), todas declaradas em ${REGISTRO}.`);
    process.exit(0);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
