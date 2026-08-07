#!/usr/bin/env node
// E00-S19 AC-1/AC-6 — `transition-all` nunca (propriedade sempre explícita) e nenhuma
// biblioteca de animação no projeto (ADR-0018: CSS + Web Animations API). A cobertura de
// `prefers-reduced-motion` é garantida por um seletor universal em index.css, não caso a caso
// — não há o que auditar aqui além da ausência de dependência.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = ["apps/web/src", "apps/portal/src"];
const IGNORAR_DIR = new Set(["node_modules", "dist", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
const BIBLIOTECAS_PROIBIDAS = ["framer-motion", "motion/react", /^motion$/, "react-spring", "gsap"];

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

let violacoes = [];

for (const dir of RAIZ) {
  for (const caminho of arquivos(dir)) {
    const linhas = readFileSync(caminho, "utf8").split("\n");
    linhas.forEach((linha, i) => {
      if (/\btransition-all\b/.test(linha)) {
        violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, motivo: "transition-all — especifique a propriedade" });
      }
      for (const lib of BIBLIOTECAS_PROIBIDAS) {
        const re = typeof lib === "string" ? new RegExp(`from ["']${lib}["']`) : lib;
        if (re.test(linha) && /^\s*import/.test(linha)) {
          violacoes.push({ arquivo: relative(process.cwd(), caminho), linha: i + 1, motivo: `biblioteca de animação proibida (ADR-0018): ${lib}` });
        }
      }
    });
  }
}

// package.json também não pode declarar a dependência, mesmo sem import ainda.
for (const pkg of ["apps/web/package.json", "apps/portal/package.json", "packages/ui/package.json"]) {
  let conteudo;
  try {
    conteudo = readFileSync(pkg, "utf8");
  } catch {
    continue;
  }
  for (const lib of ["framer-motion", "motion", "react-spring", "gsap"]) {
    if (new RegExp(`"${lib}"\\s*:`).test(conteudo)) {
      violacoes.push({ arquivo: pkg, linha: 0, motivo: `dependência de animação proibida (ADR-0018): ${lib}` });
    }
  }
}

if (violacoes.length === 0) {
  console.log("✓ check-movimento: 0 transition-all, 0 biblioteca de animação (ADR-0018).");
  process.exit(0);
}
console.error(`✗ check-movimento: ${violacoes.length} ocorrência(s).\n`);
for (const v of violacoes) console.error(`  ${v.arquivo}:${v.linha}: ${v.motivo}`);
process.exit(1);
