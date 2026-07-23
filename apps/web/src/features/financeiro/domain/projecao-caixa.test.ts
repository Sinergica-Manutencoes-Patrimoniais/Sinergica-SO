import { describe, expect, it } from "vitest";
import { primeiroPontoNegativo, temAlertaSaldoNegativo } from "./projecao-caixa";
import type { PontoProjecaoCaixa } from "./projecao-caixa";

function ponto(overrides: Partial<PontoProjecaoCaixa>): PontoProjecaoCaixa {
  return {
    diasHorizonte: 30,
    dataLimite: "2026-08-01",
    saldoProjetadoCentavos: 1000,
    entradasPrevistasCentavos: 0,
    saidasPrevistasCentavos: 0,
    ...overrides,
  };
}

describe("temAlertaSaldoNegativo", () => {
  it("detecta negativo em qualquer ponto", () => {
    expect(
      temAlertaSaldoNegativo([
        ponto({ saldoProjetadoCentavos: 100 }),
        ponto({ saldoProjetadoCentavos: -50 }),
      ]),
    ).toBe(true);
  });

  it("tudo positivo nao alerta", () => {
    expect(temAlertaSaldoNegativo([ponto({}), ponto({})])).toBe(false);
  });

  it("lista vazia nao alerta", () => {
    expect(temAlertaSaldoNegativo([])).toBe(false);
  });
});

describe("primeiroPontoNegativo", () => {
  it("acha o primeiro ponto negativo na ordem", () => {
    const pontos = [
      ponto({ diasHorizonte: 7, saldoProjetadoCentavos: 100 }),
      ponto({ diasHorizonte: 14, saldoProjetadoCentavos: -30 }),
      ponto({ diasHorizonte: 30, saldoProjetadoCentavos: -60 }),
    ];
    expect(primeiroPontoNegativo(pontos)?.diasHorizonte).toBe(14);
  });

  it("null quando nenhum negativo", () => {
    expect(primeiroPontoNegativo([ponto({})])).toBeNull();
  });
});
