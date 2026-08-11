import { describe, expect, it } from "vitest";
import {
  PrecificacaoInvalidaError,
  calcularPrecificacao,
  precoAbaixoDoPiso,
  precoVendaMaterial,
  resolverCustoMoHora,
} from "./precificacao";

describe("calcularPrecificacao", () => {
  it("calcula preço, piso e desconto máximo com margem e alíquota reais", () => {
    // custo 10.000 centavos, margem 20%, alíquota 6%
    const r = calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0.2, aliquota: 0.06 });
    expect(r.pisoCentavos).toBe(Math.round(10_000 / 0.94)); // 10638
    expect(r.precoCentavos).toBe(Math.round((10_000 * 1.2) / 0.94)); // 12766
    expect(r.descontoMaximo).toBeCloseTo(1 - 10638 / 12766, 4);
  });

  // Caso de borda da spec: margem 0 não é erro, preço = piso, desconto máximo = 0.
  it("margem 0: preço igual ao piso, desconto máximo zero", () => {
    const r = calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0, aliquota: 0.1 });
    expect(r.precoCentavos).toBe(r.pisoCentavos);
    expect(r.descontoMaximo).toBeCloseTo(0, 6);
  });

  // Caso de borda da spec: alíquota 0 é válido (empresa fora do Simples).
  it("alíquota 0: preço = custo × (1 + margem), sem gross-up", () => {
    const r = calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0.5, aliquota: 0 });
    expect(r.pisoCentavos).toBe(10_000);
    expect(r.precoCentavos).toBe(15_000);
  });

  it("custo 0: preço e piso saem zero, sem lançar (item de escopo sem custo)", () => {
    const r = calcularPrecificacao({ custoTotalCentavos: 0, margem: 0.2, aliquota: 0.1 });
    expect(r.pisoCentavos).toBe(0);
    expect(r.precoCentavos).toBe(0);
    expect(r.descontoMaximo).toBe(0);
  });

  // AC-7: alíquota >= 1 nunca vira Infinity/NaN — erro de domínio explícito.
  it("recusa alíquota 100% (divisão por zero)", () => {
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0.2, aliquota: 1 }),
    ).toThrow(PrecificacaoInvalidaError);
  });

  it("recusa alíquota acima de 100%", () => {
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0.2, aliquota: 1.5 }),
    ).toThrow(/Alíquota inválida/);
  });

  it("recusa alíquota negativa", () => {
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: 10_000, margem: 0.2, aliquota: -0.1 }),
    ).toThrow(PrecificacaoInvalidaError);
  });

  it("recusa margem negativa", () => {
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: 10_000, margem: -0.1, aliquota: 0.1 }),
    ).toThrow(/[Mm]argem/);
  });

  it("recusa custo fracionário ou negativo", () => {
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: 10.5, margem: 0.2, aliquota: 0.1 }),
    ).toThrow(PrecificacaoInvalidaError);
    expect(() =>
      calcularPrecificacao({ custoTotalCentavos: -1, margem: 0.2, aliquota: 0.1 }),
    ).toThrow(PrecificacaoInvalidaError);
  });
});

describe("precoAbaixoDoPiso", () => {
  it("detecta preço abaixo do piso", () => {
    expect(precoAbaixoDoPiso(9_000, 10_000)).toBe(true);
    expect(precoAbaixoDoPiso(10_000, 10_000)).toBe(false);
    expect(precoAbaixoDoPiso(10_001, 10_000)).toBe(false);
  });
});

describe("precoVendaMaterial", () => {
  it("aplica markup em pontos percentuais sobre o custo de referência", () => {
    expect(precoVendaMaterial({ custoReferenciaCentavos: 1_000, markupPct: 20 })).toBe(1_200);
  });

  it("markup 0 devolve o próprio custo", () => {
    expect(precoVendaMaterial({ custoReferenciaCentavos: 1_000, markupPct: 0 })).toBe(1_000);
  });

  it("recusa markup negativo", () => {
    expect(() => precoVendaMaterial({ custoReferenciaCentavos: 1_000, markupPct: -5 })).toThrow(
      PrecificacaoInvalidaError,
    );
  });
});

describe("resolverCustoMoHora", () => {
  it("usa o custo do Financeiro quando disponível", () => {
    const r = resolverCustoMoHora(2_500.7, 500_000, 220);
    expect(r).toEqual({ custoHoraCentavos: 2_501, origem: "financeiro" });
  });

  // AC-4: sem dado do Financeiro, cai na referência do nível — nunca erro, sempre com a origem
  // marcada para a UI avisar "custo estimado".
  it("sem custo do Financeiro (null), usa a referência do nível", () => {
    const r = resolverCustoMoHora(null, 440_000, 220);
    expect(r).toEqual({ custoHoraCentavos: 2_000, origem: "estimado" });
  });

  it("custo do Financeiro zero também cai no fallback (dado inválido, não confiável)", () => {
    const r = resolverCustoMoHora(0, 440_000, 220);
    expect(r.origem).toBe("estimado");
  });

  it("horas de referência zero não gera divisão por zero (usa 1h como piso de segurança)", () => {
    const r = resolverCustoMoHora(null, 1_000, 0);
    expect(r.custoHoraCentavos).toBe(1_000);
    expect(Number.isFinite(r.custoHoraCentavos)).toBe(true);
  });
});
