// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { razaoContrasteWcag, tokenCor } from "./token-cor";

describe("tokenCor — E00-S14", () => {
  it("resolve a variável CSS --color-{nome} do :root", () => {
    document.documentElement.style.setProperty("--color-danger", "#a23b25");
    expect(tokenCor("danger")).toBe("#a23b25");
  });

  it("devolve string vazia sem document (SSR/teste sem DOM)", () => {
    const docOriginal = globalThis.document;
    // @ts-expect-error — simula ambiente sem DOM
    globalThis.document = undefined;
    expect(tokenCor("danger")).toBe("");
    globalThis.document = docOriginal;
  });
});

describe("razaoContrasteWcag", () => {
  it("preto sobre branco dá a razão máxima (21:1)", () => {
    expect(razaoContrasteWcag("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("mesma cor dá razão 1:1", () => {
    expect(razaoContrasteWcag("#1c2748", "#1c2748")).toBeCloseTo(1, 5);
  });

  it("é simétrica (ordem dos argumentos não importa)", () => {
    expect(razaoContrasteWcag("#a23b25", "#1c2748")).toBeCloseTo(
      razaoContrasteWcag("#1c2748", "#a23b25"),
      5,
    );
  });
});

// DEF-32 — hex copiados de `src/index.css` (tema claro = `@theme`, tema escuro =
// `html[data-theme="dark"]`). Prova que os pares que o `KpiInspecao` e o botão de importar PDF
// usam depois da correção passam AA (4.5:1) nos dois temas, e documenta que os pares antigos
// não passavam (regressão real, não suposição — valores medidos antes da correção).
describe("DEF-32 — contraste dos indicadores de Inspeções e do botão PDF", () => {
  const navyClaro = "#1c2748";
  const navyEscuro = "#27365f";
  const cardClaro = "#ffffff";
  const cardEscuro = "#171b28";

  describe("KPI (NC/Atenção/Conf.) — badge bg-{tom}-soft + text-{tom}, autocontido", () => {
    const casos = [
      {
        tom: "danger",
        texto: "#a23b25",
        fundo: "#fff4f1",
        textoEscuro: "#f2988a",
        fundoEscuro: "#3e1f1b",
      },
      {
        tom: "warning",
        texto: "#9a5a00",
        fundo: "#fdf1df",
        textoEscuro: "#f4c767",
        fundoEscuro: "#3a2c0e",
      },
      {
        tom: "success",
        texto: "#1a7a3b",
        fundo: "#e7f6ec",
        textoEscuro: "#6fcb8e",
        fundoEscuro: "#12301e",
      },
    ];

    it.each(casos)("$tom: texto sobre o próprio fundo -soft passa 4.5:1 nos dois temas", (caso) => {
      expect(razaoContrasteWcag(caso.texto, caso.fundo)).toBeGreaterThanOrEqual(4.5);
      expect(razaoContrasteWcag(caso.textoEscuro, caso.fundoEscuro)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(casos)(
      "$tom: a versão antiga (texto direto sobre bg-navy escuro) falhava — regressão real do DEF-32",
      (caso) => {
        // antes do fix: `text-{tom}-soft`/`-line` usado como cor de texto direto sobre bg-navy.
        expect(razaoContrasteWcag(caso.fundoEscuro, navyEscuro)).toBeLessThan(4.5);
      },
    );
  });

  it("KPI muted (N/A): text-white/45 falhava (~3.7–4.1:1); text-white/65 passa 4.5:1 nos dois temas", () => {
    const blend = (alpha: number, fundo: string) => {
      const f = fundo.replace("#", "");
      const canal = (i: number) =>
        Math.round(255 * alpha + Number.parseInt(f.slice(i, i + 2), 16) * (1 - alpha));
      return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, "0")).join("")}`;
    };
    expect(razaoContrasteWcag(blend(0.45, navyClaro), navyClaro)).toBeLessThan(4.5);
    expect(razaoContrasteWcag(blend(0.45, navyEscuro), navyEscuro)).toBeLessThan(4.5);
    expect(razaoContrasteWcag(blend(0.65, navyClaro), navyClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoContrasteWcag(blend(0.65, navyEscuro), navyEscuro)).toBeGreaterThanOrEqual(4.5);
  });

  it("botão PDF: border/text-navy sobre bg-card falhava no tema escuro (~1.45:1)", () => {
    expect(razaoContrasteWcag(navyEscuro, cardEscuro)).toBeLessThan(3);
  });

  it("botão PDF: border/text-info sobre bg-card passa 4.5:1 nos dois temas", () => {
    const infoClaro = "#2e3c70";
    const infoEscuro = "#a8b6e8";
    expect(razaoContrasteWcag(infoClaro, cardClaro)).toBeGreaterThanOrEqual(4.5);
    expect(razaoContrasteWcag(infoEscuro, cardEscuro)).toBeGreaterThanOrEqual(4.5);
  });
});
