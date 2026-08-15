import { describe, expect, it } from "vitest";
import {
  type GastoLogItem,
  formatarCustoIA,
  formatarCustoTotalIA,
  resumoGastoMes,
  verificarQuotaExcedida,
} from "./ia-gasto";

function log(overrides: Partial<GastoLogItem>): GastoLogItem {
  return {
    id: "1",
    modulo: "atendimento",
    usdCost: 0.01,
    modelo: "google/gemini-2.5-flash",
    promptTokens: 100,
    completionTokens: 50,
    refId: null,
    endpoint: "pcm-ze-agent",
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("resumoGastoMes", () => {
  it("soma zero quando não há logs, sem quebrar por módulo ausente", () => {
    const resumo = resumoGastoMes([]);
    expect(resumo.usdTotal).toBe(0);
    expect(resumo.porModulo).toHaveLength(3);
    expect(resumo.porModulo.every((m) => m.qtde === 0 && m.usdMedio === 0)).toBe(true);
  });

  it("agrupa por módulo e calcula total geral e média por módulo", () => {
    const logs = [
      log({ modulo: "inspecao", usdCost: 0.02 }),
      log({ modulo: "inspecao", usdCost: 0.04 }),
      log({ modulo: "atendimento", usdCost: 0.01 }),
    ];
    const resumo = resumoGastoMes(logs);
    expect(resumo.usdTotal).toBeCloseTo(0.07);
    const inspecao = resumo.porModulo.find((m) => m.modulo === "inspecao");
    expect(inspecao?.usdTotal).toBeCloseTo(0.06);
    expect(inspecao?.qtde).toBe(2);
    expect(inspecao?.usdMedio).toBeCloseTo(0.03);
    const previsoes = resumo.porModulo.find((m) => m.modulo === "previsoes");
    expect(previsoes?.qtde).toBe(0);
  });
});

describe("verificarQuotaExcedida", () => {
  it("sem limite (null) nunca avisa nem excede", () => {
    expect(verificarQuotaExcedida(1000, null)).toEqual({
      percentual: null,
      aviso90: false,
      excedida: false,
    });
  });

  it("limite zero/negativo também é tratado como sem limite", () => {
    expect(verificarQuotaExcedida(1000, 0)).toEqual({
      percentual: null,
      aviso90: false,
      excedida: false,
    });
    expect(verificarQuotaExcedida(1000, -5)).toEqual({
      percentual: null,
      aviso90: false,
      excedida: false,
    });
  });

  it("abaixo de 90% não avisa", () => {
    const status = verificarQuotaExcedida(50, 100);
    expect(status.aviso90).toBe(false);
    expect(status.excedida).toBe(false);
    expect(status.percentual).toBeCloseTo(50);
  });

  it("entre 90% e 100% avisa mas não excede", () => {
    const status = verificarQuotaExcedida(95, 100);
    expect(status.aviso90).toBe(true);
    expect(status.excedida).toBe(false);
  });

  it("a partir de 100% excede (e não avisa mais — já excedeu)", () => {
    const status = verificarQuotaExcedida(100, 100);
    expect(status.excedida).toBe(true);
    expect(status.aviso90).toBe(false);
    const acima = verificarQuotaExcedida(150, 100);
    expect(acima.excedida).toBe(true);
  });
});

describe("formatarCustoIA", () => {
  it("mostra 4 casas decimais em USD", () => {
    expect(formatarCustoIA(0.0042)).toBe("$0.0042");
  });

  it("não colapsa valores pequenos em zero", () => {
    expect(formatarCustoIA(0.0001)).toBe("$0.0001");
  });
});

describe("formatarCustoTotalIA", () => {
  it("mostra 2 casas decimais em USD pro total do dashboard", () => {
    expect(formatarCustoTotalIA(12.3)).toBe("$12.30");
  });
});
