import { describe, expect, it } from "vitest";
import {
  amostraPequena,
  calcularBreakEvenCentavos,
  calcularBurnMedioCentavos,
  calcularDespesasMediasCentavos,
  calcularMargemContribuicao,
  calcularRunwayMeses,
  calcularTicketMedioCentavos,
} from "./cockpit";
import type { PontoFluxoMensal } from "./dashboard";

const pontosQueimandoCaixa: PontoFluxoMensal[] = [
  {
    mes: "2026-05-01",
    entradasCentavos: 10_000_00,
    saidasCentavos: 12_000_00,
    resultadoCentavos: -2_000_00,
  },
  {
    mes: "2026-06-01",
    entradasCentavos: 9_000_00,
    saidasCentavos: 11_000_00,
    resultadoCentavos: -2_000_00,
  },
];

const pontosLucrativos: PontoFluxoMensal[] = [
  {
    mes: "2026-05-01",
    entradasCentavos: 15_000_00,
    saidasCentavos: 10_000_00,
    resultadoCentavos: 5_000_00,
  },
  {
    mes: "2026-06-01",
    entradasCentavos: 16_000_00,
    saidasCentavos: 11_000_00,
    resultadoCentavos: 5_000_00,
  },
];

describe("calcularBurnMedioCentavos", () => {
  it("queimando caixa: burn positivo", () => {
    expect(calcularBurnMedioCentavos(pontosQueimandoCaixa)).toBe(200_000);
  });
  it("lucrativo: burn negativo (gerando caixa)", () => {
    expect(calcularBurnMedioCentavos(pontosLucrativos)).toBeLessThan(0);
  });
  it("sem pontos: 0", () => {
    expect(calcularBurnMedioCentavos([])).toBe(0);
  });
});

describe("calcularRunwayMeses", () => {
  it("burn positivo: saldo/burn", () => {
    expect(calcularRunwayMeses(1_000_000, 200_000)).toBe(5);
  });
  it("burn zero ou negativo: runway infinito (null) — nunca divide por zero", () => {
    expect(calcularRunwayMeses(1_000_000, 0)).toBeNull();
    expect(calcularRunwayMeses(1_000_000, -50_000)).toBeNull();
  });
  it("saldo já esgotado com burn positivo: 0", () => {
    expect(calcularRunwayMeses(0, 100_000)).toBe(0);
    expect(calcularRunwayMeses(-500, 100_000)).toBe(0);
  });
});

describe("calcularMargemContribuicao e calcularBreakEvenCentavos", () => {
  it("margem positiva calcula break-even", () => {
    const margem = calcularMargemContribuicao(pontosLucrativos);
    expect(margem).toBeGreaterThan(0);
    const despesas = calcularDespesasMediasCentavos(pontosLucrativos);
    expect(calcularBreakEvenCentavos(despesas, margem as number)).toBeGreaterThan(0);
  });

  it("margem negativa (nunca fechou positivo): break-even null (edge case, não inventa número)", () => {
    const margem = calcularMargemContribuicao(pontosQueimandoCaixa);
    expect(margem).toBeLessThan(0);
    expect(calcularBreakEvenCentavos(100_000_00, margem as number)).toBeNull();
  });

  it("sem entradas: margem null", () => {
    expect(
      calcularMargemContribuicao([
        { mes: "2026-05-01", entradasCentavos: 0, saidasCentavos: 5000, resultadoCentavos: -5000 },
      ]),
    ).toBeNull();
  });
});

describe("calcularTicketMedioCentavos", () => {
  it("divide receita por clientes com receita", () => {
    expect(calcularTicketMedioCentavos(30_000_00, 3)).toBe(10_000_00);
  });
  it("zero clientes: 0 (nunca divide por zero)", () => {
    expect(calcularTicketMedioCentavos(30_000_00, 0)).toBe(0);
  });
});

describe("amostraPequena", () => {
  it("menos de 3 meses: amostra pequena", () => {
    expect(amostraPequena(0)).toBe(true);
    expect(amostraPequena(2)).toBe(true);
  });
  it("3 ou mais meses: amostra ok", () => {
    expect(amostraPequena(3)).toBe(false);
    expect(amostraPequena(12)).toBe(false);
  });
});
