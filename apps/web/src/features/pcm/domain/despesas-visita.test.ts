import { describe, expect, it } from "vitest";
import {
  valoresParaRelatorio,
  validarRateio,
  custoParaApuracao,
  consolidarDespesasVisita,
} from "./despesas-visita";

describe("despesas de Visita: cálculo local", () => {
  it("consolida previsto e realizado em eixos separados e ignora canceladas", () => {
    expect(
      consolidarDespesasVisita([
        { id: "a", previstoCentavos: 10000, realizadoCentavos: 6000, status: "ativa" },
        { id: "b", previstoCentavos: 3000, realizadoCentavos: null, status: "ativa" },
        { id: "c", previstoCentavos: 500, realizadoCentavos: 0, status: "ativa" },
        { id: "d", previstoCentavos: 1000, realizadoCentavos: 1000, status: "cancelada" },
      ]),
    ).toEqual({ previstoCentavos: 13500, realizadoCentavos: 6000, semRealizacao: 1 });
  });
  it("rejeita despesas repetidas e somas fora da precisão segura", () => {
    const item = {
      id: "a",
      previstoCentavos: 1,
      realizadoCentavos: null,
      status: "ativa" as const,
    };
    expect(() => consolidarDespesasVisita([item, item])).toThrow();
    expect(() =>
      consolidarDespesasVisita([
        { ...item, previstoCentavos: Number.MAX_SAFE_INTEGER },
        { ...item, id: "b" },
      ]),
    ).toThrow();
  });
  it("rejeita status desconhecido em vez de incluir despesa como ativa", () => {
    const despesa = {
      previstoCentavos: 10000,
      realizadoCentavos: null,
      status: "desconhecida" as never,
      visitaId: "v",
      clienteId: "c",
    };
    expect(() => valoresParaRelatorio(despesa)).toThrow();
    expect(validarRateio(despesa, [])).toBe(false);
  });
  it("distingue realizado zero de realizado ausente e exclui cancelada", () => {
    expect(
      valoresParaRelatorio({ previstoCentavos: 10000, realizadoCentavos: null, status: "ativa" }),
    ).toEqual({ previstoCentavos: 10000, realizadoCentavos: null });
    expect(
      valoresParaRelatorio({ previstoCentavos: 10000, realizadoCentavos: 0, status: "ativa" }),
    ).toEqual({ previstoCentavos: 10000, realizadoCentavos: 0 });
    expect(
      valoresParaRelatorio({
        previstoCentavos: 10000,
        realizadoCentavos: 5000,
        status: "cancelada",
      }),
    ).toBeNull();
  });
  it("usa realizado, inclusive zero, ou previsão apenas quando não realizado; não soma ambos", () => {
    expect(
      custoParaApuracao({ previstoCentavos: 10000, realizadoCentavos: 6000, status: "ativa" }),
    ).toEqual({ base: "realizado", valorCentavos: 6000 });
    expect(
      custoParaApuracao({ previstoCentavos: 10000, realizadoCentavos: 0, status: "ativa" }),
    ).toEqual({ base: "realizado", valorCentavos: 0 });
    expect(
      custoParaApuracao({ previstoCentavos: 10000, realizadoCentavos: null, status: "ativa" }),
    ).toEqual({ base: "previsto", valorCentavos: 10000 });
    expect(
      custoParaApuracao({ previstoCentavos: 10000, realizadoCentavos: 0, status: "cancelada" }),
    ).toBeNull();
  });
  it("aceita rateio ausente ou exato sem multiplicar custo", () => {
    const despesa = {
      previstoCentavos: 10000,
      realizadoCentavos: null,
      status: "ativa" as const,
      visitaId: "visita",
      clienteId: "cliente",
    };
    expect(validarRateio(despesa, [])).toBe(true);
    expect(
      validarRateio(despesa, [
        { osId: "os1", visitaId: "visita", clienteId: "cliente", valorCentavos: 6000 },
        { osId: "os2", visitaId: "visita", clienteId: "cliente", valorCentavos: 4000 },
      ]),
    ).toBe(true);
  });
  it("rejeita rateio parcial, excessivo, duplicado e de outro escopo", () => {
    const despesa = {
      previstoCentavos: 10000,
      realizadoCentavos: null,
      status: "ativa" as const,
      visitaId: "visita",
      clienteId: "cliente",
    };
    const parcela = { osId: "os1", visitaId: "visita", clienteId: "cliente", valorCentavos: 10000 };
    expect(validarRateio(despesa, [{ ...parcela, valorCentavos: 9999 }])).toBe(false);
    expect(validarRateio(despesa, [{ ...parcela, valorCentavos: 10001 }])).toBe(false);
    expect(
      validarRateio(despesa, [
        { ...parcela, valorCentavos: 5000 },
        { ...parcela, valorCentavos: 5000 },
      ]),
    ).toBe(false);
    expect(validarRateio(despesa, [{ ...parcela, clienteId: "outro" }])).toBe(false);
    expect(validarRateio(despesa, [{ ...parcela, visitaId: "outra" }])).toBe(false);
  });
  it("valida valores inteiros seguros e usa realizado como base inclusive zero", () => {
    const despesa = {
      previstoCentavos: 10000,
      realizadoCentavos: 0,
      status: "ativa" as const,
      visitaId: "visita",
      clienteId: "cliente",
    };
    const parcela = { osId: "os1", visitaId: "visita", clienteId: "cliente", valorCentavos: 0 };
    expect(validarRateio(despesa, [parcela])).toBe(true);
    expect(validarRateio(despesa, [{ ...parcela, valorCentavos: 1 }])).toBe(false);
    expect(validarRateio(despesa, [{ ...parcela, valorCentavos: -1 }])).toBe(false);
    expect(validarRateio(despesa, [{ ...parcela, valorCentavos: 0.5 }])).toBe(false);
    expect(() => valoresParaRelatorio({ ...despesa, realizadoCentavos: NaN })).toThrow();
  });
});
