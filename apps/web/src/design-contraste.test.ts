// E00-S14 AC-5 — todo par token texto/fundo declarado atinge o mínimo legal de contraste
// (WCAG AA), nos dois temas. Lê os valores direto de index.css (nunca duplica hex aqui) pra
// nunca dessincronizar do que está realmente publicado.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function lerTokens(bloco: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g;
  let m = re.exec(bloco);
  while (m) {
    const [, nome, hex] = m;
    if (nome && hex) tokens[nome] = hex;
    m = re.exec(bloco);
  }
  return tokens;
}

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const inicioTema = css.indexOf("@theme");
const fimTema = css.indexOf("\n}", inicioTema);
const blocoClaro = css.slice(inicioTema, fimTema);

const inicioDark = css.indexOf('html[data-theme="dark"]');
const fimDark = css.indexOf("\n  }", inicioDark);
const blocoEscuro = css.slice(inicioDark, fimDark);

const claro = lerTokens(blocoClaro);
// tema escuro herda o que não foi sobrescrito
const escuro = { ...claro, ...lerTokens(blocoEscuro) };

function paraRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const v = Number.parseInt(n.slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [canal(r), canal(g), canal(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contraste(hexA: string, hexB: string): number {
  const la = luminanciaRelativa(paraRgb(hexA));
  const lb = luminanciaRelativa(paraRgb(hexB));
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

// texto sobre fundo — pares realmente usados no produto (não todo par possível, só o que existe).
const PARES: Array<[string, string]> = [
  ["ink", "card"],
  ["ink", "paper"],
  ["ink-2", "card"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["info", "info-soft"],
];

describe.each([
  ["claro", claro],
  ["escuro", escuro],
])("contraste WCAG AA — tema %s", (_nomeTema, tokens) => {
  it.each(PARES)("%s sobre %s ≥ 4.5:1", (texto, fundo) => {
    const hexTexto = tokens[texto];
    const hexFundo = tokens[fundo];
    if (!hexTexto) throw new Error(`token --color-${texto} não encontrado`);
    if (!hexFundo) throw new Error(`token --color-${fundo} não encontrado`);
    expect(contraste(hexTexto, hexFundo)).toBeGreaterThanOrEqual(4.5);
  });
});
