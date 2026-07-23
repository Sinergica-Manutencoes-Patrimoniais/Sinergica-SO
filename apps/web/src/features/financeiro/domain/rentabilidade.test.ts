import { describe, expect, it } from "vitest";
import {
  cobertura,
  custoHoraDerivado,
  ranquearPorMargem,
  temAlertaMargemNegativa,
  validarCustoFuncionario,
} from "./rentabilidade";
import type { RentabilidadeMes } from "./rentabilidade";

describe("validarCustoFuncionario", () => {
  const base = {
    funcionarioId: "f1",
    custoMensalCentavos: 500000,
    horasMesBase: 220,
    vigenteDesde: "2026-01-01",
  };

  it("exige funcionario", () => {
    expect(() => validarCustoFuncionario({ ...base, funcionarioId: "" })).toThrow(
      "Funcionário é obrigatório.",
    );
  });

  it("rejeita custo zero", () => {
    expect(() => validarCustoFuncionario({ ...base, custoMensalCentavos: 0 })).toThrow(
      "Custo mensal deve ser maior que zero.",
    );
  });

  it("rejeita horas-base zero", () => {
    expect(() => validarCustoFuncionario({ ...base, horasMesBase: 0 })).toThrow(
      "Horas-base do mês deve ser maior que zero.",
    );
  });
});

describe("custoHoraDerivado", () => {
  it("divide custo mensal por horas-base", () => {
    expect(custoHoraDerivado(220000, 220)).toBe(1000);
  });

  it("lanca erro para horas-base zero (divisao por zero)", () => {
    expect(() => custoHoraDerivado(1000, 0)).toThrow("Horas-base do mês deve ser maior que zero.");
  });
});

describe("cobertura", () => {
  it("calcula percentual de horas valoradas", () => {
    expect(cobertura({ horasTotais: 100, horasValoradas: 92 })).toBe(92);
  });

  it("sem horas totais considera 100% (nada a valorar)", () => {
    expect(cobertura({ horasTotais: 0, horasValoradas: 0 })).toBe(100);
  });
});

function mes(overrides: Partial<RentabilidadeMes>): RentabilidadeMes {
  return {
    clienteId: "c1",
    mes: "2026-01-01",
    receitaCentavos: 1000,
    custoMoCentavos: 500,
    custoDespesasCentavos: 0,
    horasTotais: 10,
    horasValoradas: 10,
    margemCentavos: 500,
    margemPercentual: 50,
    ...overrides,
  };
}

describe("temAlertaMargemNegativa", () => {
  it("dispara com 2 meses fechados consecutivos negativos", () => {
    const itens = [
      mes({ mes: "2026-05-01", margemCentavos: -100 }),
      mes({ mes: "2026-06-01", margemCentavos: -200 }),
    ];
    expect(temAlertaMargemNegativa(itens, "2026-07-01")).toBe(true);
  });

  it("nao dispara se so 1 mes negativo", () => {
    const itens = [
      mes({ mes: "2026-05-01", margemCentavos: 100 }),
      mes({ mes: "2026-06-01", margemCentavos: -200 }),
    ];
    expect(temAlertaMargemNegativa(itens, "2026-07-01")).toBe(false);
  });

  it("mes corrente incompleto nunca dispara sozinho", () => {
    const itens = [
      mes({ mes: "2026-06-01", margemCentavos: -200 }),
      mes({ mes: "2026-07-01", margemCentavos: -999 }),
    ];
    expect(temAlertaMargemNegativa(itens, "2026-07-01")).toBe(false);
  });

  it("menos de 2 meses fechados nao dispara", () => {
    expect(
      temAlertaMargemNegativa([mes({ mes: "2026-06-01", margemCentavos: -1 })], "2026-07-01"),
    ).toBe(false);
  });
});

describe("ranquearPorMargem", () => {
  it("ordena desc por margem", () => {
    const itens = [
      mes({ clienteId: "a", margemCentavos: 100 }),
      mes({ clienteId: "b", margemCentavos: 900 }),
    ];
    expect(ranquearPorMargem(itens).map((i) => i.clienteId)).toEqual(["b", "a"]);
  });
});
