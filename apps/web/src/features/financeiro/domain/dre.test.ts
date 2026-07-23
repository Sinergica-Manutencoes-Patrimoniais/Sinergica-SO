import { describe, expect, it } from "vitest";
import { agregarDre, calcularDesvio } from "./dre";
import type { LinhaDre } from "./dre";

describe("agregarDre", () => {
  const linhas: LinhaDre[] = [
    {
      mes: "2026-07-01",
      tipo: "entrada",
      categoriaRaizNome: "Receita de contrato",
      valorCentavos: 100_000,
    },
    { mes: "2026-07-01", tipo: "saida", categoriaRaizNome: "Pessoal", valorCentavos: 40_000 },
    {
      mes: "2026-07-01",
      tipo: "saida",
      categoriaRaizNome: "Impostos e taxas",
      valorCentavos: 6_000,
    },
  ];

  it("agrega receita, despesas por grupo e resultado líquido", () => {
    const dres = agregarDre(linhas, ["2026-07-01"]);
    expect(dres).toHaveLength(1);
    const dre = dres[0] as NonNullable<(typeof dres)[number]>;
    expect(dre.receitaCentavos).toBe(100_000);
    expect(dre.despesasTotalCentavos).toBe(46_000);
    expect(dre.resultadoCentavos).toBe(54_000);
    expect(dre.despesasPorGrupo).toHaveLength(2);
  });

  it("mês sem lançamento aparece zerado, não some (edge case)", () => {
    const dres = agregarDre(linhas, ["2026-07-01", "2026-08-01"]);
    expect(dres).toHaveLength(2);
    const agosto = dres[1] as NonNullable<(typeof dres)[number]>;
    expect(agosto.receitaCentavos).toBe(0);
    expect(agosto.resultadoCentavos).toBe(0);
  });
});

describe("calcularDesvio", () => {
  it("categoria sem orçamento: só realizado, sem percentual, nunca estoura (edge case)", () => {
    const d = calcularDesvio("c1", "Combustível", 0, 5_000, false);
    expect(d.temOrcamento).toBe(false);
    expect(d.desvioPercentual).toBeNull();
    expect(d.estourou).toBe(false);
    expect(d.realizadoCentavos).toBe(5_000);
  });

  it("realizado acima do orçado: estoura, desvio positivo", () => {
    const d = calcularDesvio("c1", "Pessoal", 40_000, 45_000, true);
    expect(d.estourou).toBe(true);
    expect(d.desvioCentavos).toBe(5_000);
    expect(d.desvioPercentual).toBeCloseTo(12.5, 4);
  });

  it("realizado abaixo do orçado: não estoura, desvio negativo", () => {
    const d = calcularDesvio("c1", "Pessoal", 40_000, 30_000, true);
    expect(d.estourou).toBe(false);
    expect(d.desvioCentavos).toBe(-10_000);
  });
});
