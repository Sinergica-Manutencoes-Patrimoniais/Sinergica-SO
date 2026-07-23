import { describe, expect, it } from "vitest";
import {
  FAIXAS_ANEXO_III_PADRAO,
  calcularAliquotaEfetiva,
  calcularProvisaoImposto,
  validarConfigImpostos,
} from "./impostos";
import type { ConfigImpostos } from "./impostos";

describe("calcularAliquotaEfetiva", () => {
  it("tipo fixa ignora RBT12 e devolve a alíquota configurada", () => {
    const config: ConfigImpostos = {
      tipo: "fixa",
      aliquotaFixa: 0.08,
      faixas: [],
      diaVencimento: 20,
    };
    expect(calcularAliquotaEfetiva(config, 100_000_00)).toBe(0.08);
  });

  it("tipo fixa sem alíquota configurada devolve 0", () => {
    const config: ConfigImpostos = {
      tipo: "fixa",
      aliquotaFixa: null,
      faixas: [],
      diaVencimento: 20,
    };
    expect(calcularAliquotaEfetiva(config, 100_000_00)).toBe(0);
  });

  it("faixa 1 do Anexo III (RBT12 até 180mil): alíquota efetiva = nominal (parcela a deduzir zero)", () => {
    const config: ConfigImpostos = {
      tipo: "faixa_rbt12",
      aliquotaFixa: null,
      faixas: FAIXAS_ANEXO_III_PADRAO,
      diaVencimento: 20,
    };
    // RBT12 = 100.000,00 -> dentro da faixa 1 (6%, parcela 0) -> efetiva = 6%
    expect(calcularAliquotaEfetiva(config, 100_000_00)).toBeCloseTo(0.06, 4);
  });

  it("faixa 2 do Anexo III (RBT12 = 200mil): efetiva menor que a nominal por causa da parcela a deduzir", () => {
    const config: ConfigImpostos = {
      tipo: "faixa_rbt12",
      aliquotaFixa: null,
      faixas: FAIXAS_ANEXO_III_PADRAO,
      diaVencimento: 20,
    };
    // RBT12 = 200.000,00 -> faixa 2 (11,2%, parcela R$9.360) -> efetiva = (200000*0.112 - 9360)/200000
    const esperado = (200_000_00 * 0.112 - 936_000) / 200_000_00;
    expect(calcularAliquotaEfetiva(config, 200_000_00)).toBeCloseTo(esperado, 6);
    expect(calcularAliquotaEfetiva(config, 200_000_00)).toBeLessThan(0.112);
  });

  it("RBT12 zero ou negativo devolve 0 (sem divisão por zero)", () => {
    const config: ConfigImpostos = {
      tipo: "faixa_rbt12",
      aliquotaFixa: null,
      faixas: FAIXAS_ANEXO_III_PADRAO,
      diaVencimento: 20,
    };
    expect(calcularAliquotaEfetiva(config, 0)).toBe(0);
    expect(calcularAliquotaEfetiva(config, -100)).toBe(0);
  });

  it("RBT12 acima de todas as faixas usa a última (sem teto)", () => {
    const config: ConfigImpostos = {
      tipo: "faixa_rbt12",
      aliquotaFixa: null,
      faixas: FAIXAS_ANEXO_III_PADRAO,
      diaVencimento: 20,
    };
    expect(calcularAliquotaEfetiva(config, 500_000_000_00)).toBeGreaterThan(0);
  });
});

describe("calcularProvisaoImposto", () => {
  it("receita zero não provisiona (edge case AC)", () => {
    expect(calcularProvisaoImposto(0, 0.06)).toBe(0);
  });

  it("calcula e arredonda pro centavo", () => {
    expect(calcularProvisaoImposto(10_000_00, 0.06)).toBe(60_000); // 10.000,00 * 6% = 600,00
  });

  it("alíquota zero não provisiona", () => {
    expect(calcularProvisaoImposto(10_000_00, 0)).toBe(0);
  });
});

describe("validarConfigImpostos", () => {
  it("exige alíquota fixa > 0 quando tipo=fixa", () => {
    expect(() =>
      validarConfigImpostos({ tipo: "fixa", aliquotaFixa: null, faixas: [], diaVencimento: 20 }),
    ).toThrow("Informe uma alíquota fixa maior que zero.");
  });

  it("exige ao menos 1 faixa quando tipo=faixa_rbt12", () => {
    expect(() =>
      validarConfigImpostos({
        tipo: "faixa_rbt12",
        aliquotaFixa: null,
        faixas: [],
        diaVencimento: 20,
      }),
    ).toThrow("Informe ao menos uma faixa de RBT12.");
  });

  it("exige dia de vencimento entre 1 e 28", () => {
    expect(() =>
      validarConfigImpostos({ tipo: "fixa", aliquotaFixa: 0.06, faixas: [], diaVencimento: 31 }),
    ).toThrow("Dia de vencimento deve ser entre 1 e 28.");
  });

  it("aceita config válida", () => {
    const config: ConfigImpostos = {
      tipo: "fixa",
      aliquotaFixa: 0.06,
      faixas: [],
      diaVencimento: 20,
    };
    expect(validarConfigImpostos(config)).toBe(config);
  });
});
