#!/usr/bin/env node
// E00-S14 — codemod mecânico: hex cru em classe utilitária → token semântico mais próximo
// (distância euclidiana em RGB contra a paleta declarada em index.css). Idempotente: rodar de
// novo não altera nada já migrado. Gera relatório em scripts/.codemod-tokens-cor-relatorio.json
// pra revisão humana dos casos que não eram cor de status (ex.: variante de laranja de marca).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = process.argv.includes("--dir")
  ? [process.argv[process.argv.indexOf("--dir") + 1]]
  : ["apps/web/src", "apps/portal/src"];
const SECO = process.argv.includes("--dry-run");

const IGNORAR_DIR = new Set(["node_modules", "dist", "lib/pdf", "test-results"]);
const IGNORAR_ARQUIVO = /\.(test|d)\.tsx?$/;
const ALLOWLIST_TRECHO = ['cliente.marcacao?.cor ?? "#9CA3AF"'];

// Override explícito pra hex onde o vizinho-mais-próximo por cor erra o significado (contexto
// resolvido à mão, ver commit/PR de E00-S14):
// - a8b0cc: só aparece em texto sobre a sidebar navy (`HomePage.tsx`) — nearest-neighbor mandava
//   pra ink-4, que escurece no tema escuro e sumiria contra a sidebar (que não escurece igual).
// - eff1f4: pill neutro pareado com ink-2 (não é badge de info/azul como eaeef8/eef2ff, que têm
//   o mesmo tom mas emparelham com texto navy) — nearest-neighbor mandava pra "card", que
//   desapareceria contra o próprio card branco que o cerca.
const OVERRIDE_HEX = {
  a8b0cc: "nav-ink",
  eff1f4: "line-soft",
};

// Paleta-alvo = exatamente os valores hoje em @theme (index.css), tema claro e escuro.
// Nomes seguem a convenção de token (ex.: "danger-soft" → classe `bg-danger-soft`).
const CLARO = {
  navy: "#1c2748",
  "navy-deep": "#141c36",
  "navy-line": "#2e3a60",
  orange: "#e8731b",
  "orange-deep": "#d2630f",
  "orange-soft": "#fbeee0",
  amber: "#f4a300",
  paper: "#f4f2ec",
  card: "#ffffff",
  line: "#e5e2d9",
  "line-soft": "#edeae2",
  ink: "#1a2138",
  "ink-2": "#585e72",
  "ink-3": "#8c8f9b",
  "ink-4": "#b4b6be",
  success: "#1e8e45",
  "success-soft": "#e7f6ec",
  "success-line": "#bfe9cc",
  warning: "#b26a00",
  "warning-soft": "#fdf1df",
  "warning-line": "#f0d4b0",
  danger: "#a23b25",
  "danger-soft": "#fff4f1",
  "danger-line": "#f2c0b5",
  info: "#2e3c70",
  "info-soft": "#eaeef8",
  "info-line": "#c7d0ec",
};

const ESCURO = {
  navy: "#27365f",
  "navy-deep": "#10172d",
  "navy-line": "#38456d",
  "orange-soft": "#402817",
  paper: "#10131d",
  card: "#171b28",
  line: "#2a3040",
  "line-soft": "#222838",
  ink: "#f3f5fa",
  "ink-2": "#c8cedb",
  "ink-3": "#939cad",
  "ink-4": "#697285",
  success: "#6fcb8e",
  "success-soft": "#12301e",
  "success-line": "#1f4a30",
  warning: "#f4c767",
  "warning-soft": "#3a2c0e",
  "warning-line": "#4f3a12",
  danger: "#f2988a",
  "danger-soft": "#3e1f1b",
  "danger-line": "#5a2e27",
  info: "#a8b6e8",
  "info-soft": "#202b4d",
  "info-line": "#35427a",
};

function paraRgb(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = Number.parseInt(n.slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// RGB puro confunde marrom-escuro (aviso) com vermelho-escuro (erro) — casos reais encontrados
// no dry-run (#7A3F00 é texto de banner de aviso, ficava mais perto de "danger" em RGB cru).
// HSL com matiz pesado por saturação resolve: cor de baixa saturação (cinza) não é punida por
// matiz instável; cor saturada é discriminada corretamente entre vermelho/laranja/verde/azul.
function paraHsl(hex) {
  const [r, g, b] = paraRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function distancia(a, b) {
  const [h1, s1, l1] = paraHsl(a);
  const [h2, s2, l2] = paraHsl(b);
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)) / 180;
  const pesoMatiz = 3 * Math.sqrt(s1 * s2); // desliga o peso de matiz pra cores acinzentadas
  const ds = s1 - s2;
  const dl = l1 - l2;
  return (dh * pesoMatiz) ** 2 + (ds * 1.5) ** 2 + (dl * 1.2) ** 2;
}

function tokenMaisProximo(hex, paleta) {
  let melhorNome = null;
  let melhorDist = Number.POSITIVE_INFINITY;
  for (const [nome, valor] of Object.entries(paleta)) {
    const d = distancia(hex, valor);
    if (d < melhorDist) {
      melhorDist = d;
      melhorNome = nome;
    }
  }
  return { nome: melhorNome, exato: melhorDist === 0 };
}

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
    if (info.isDirectory()) out = out.concat(arquivosTsx(caminho));
    else if (/\.tsx?$/.test(nome) && !IGNORAR_ARQUIVO.test(nome)) out.push(caminho);
  }
  return out;
}

const PADRAO_TOKEN = /\b(dark:)?(bg|text|border|ring|from|to|via|outline|fill|stroke|divide|decoration|caret|accent|shadow)-\[#([0-9A-Fa-f]{3,8})\]/g;

function processarLinha(linha, relatorio, caminho, numeroLinha) {
  if (ALLOWLIST_TRECHO.some((t) => linha.includes(t))) return linha;

  // Detecta, na linha, quais (prop) já têm substituição no modo claro — pra saber se o
  // `dark:` correspondente pode ser removido (o token agora flipa sozinho).
  const propsComClaroSubstituido = new Set();
  const matches = [...linha.matchAll(PADRAO_TOKEN)];
  for (const m of matches) {
    const [, dark, prop, hex] = m;
    if (!dark) propsComClaroSubstituido.add(prop);
  }

  return linha.replace(PADRAO_TOKEN, (original, dark, prop, hexCurto) => {
    const hex = `#${hexCurto}`;
    if (hexCurto.length !== 6) {
      relatorio.push({ arquivo: caminho, linha: numeroLinha, original, motivo: "hex não-6-dígitos, revisão manual" });
      return original;
    }
    const hexBaixo = hexCurto.toLowerCase();
    if (dark) {
      if (propsComClaroSubstituido.has(prop)) {
        // token já flipa sozinho — a variante dark: explícita fica redundante.
        return "__REMOVER__";
      }
      if (OVERRIDE_HEX[hexBaixo]) return `dark:${prop}-${OVERRIDE_HEX[hexBaixo]}`;
      const { nome, exato } = tokenMaisProximo(hex, ESCURO);
      if (!exato) relatorio.push({ arquivo: caminho, linha: numeroLinha, original, aproximado: `dark:${prop}-${nome}` });
      return `dark:${prop}-${nome}`;
    }
    if (OVERRIDE_HEX[hexBaixo]) return `${prop}-${OVERRIDE_HEX[hexBaixo]}`;
    const { nome, exato } = tokenMaisProximo(hex, CLARO);
    if (!exato) relatorio.push({ arquivo: caminho, linha: numeroLinha, original, aproximado: `${prop}-${nome}` });
    return `${prop}-${nome}`;
  });
}

let totalArquivos = 0;
let totalSubstituicoes = 0;
const relatorio = [];

for (const dir of raiz) {
  for (const caminho of arquivosTsx(dir)) {
    const original = readFileSync(caminho, "utf8");
    const antesCount = (original.match(PADRAO_TOKEN) || []).length;
    if (antesCount === 0 && !original.includes("bg-white") && !original.includes("text-black")) continue;

    const linhas = original.split("\n");
    const novasLinhas = linhas.map((linha, i) => processarLinha(linha, relatorio, relative(process.cwd(), caminho), i + 1));

    let novoConteudo = novasLinhas
      .join("\n")
      .replace(/\s*__REMOVER__/g, "")
      .replace(/\bbg-white\b/g, "bg-card")
      .replace(/\btext-black\b/g, "text-ink");

    if (novoConteudo !== original) {
      totalArquivos += 1;
      totalSubstituicoes += antesCount;
      if (!SECO) writeFileSync(caminho, novoConteudo, "utf8");
    }
  }
}

writeFileSync(
  "scripts/.codemod-tokens-cor-relatorio.json",
  JSON.stringify(relatorio, null, 2),
  "utf8",
);

console.log(
  `${SECO ? "[dry-run] " : ""}${totalArquivos} arquivo(s) tocados, ${totalSubstituicoes} ocorrência(s) processadas.`,
);
console.log(`${relatorio.length} caso(s) sem match exato — ver scripts/.codemod-tokens-cor-relatorio.json`);
