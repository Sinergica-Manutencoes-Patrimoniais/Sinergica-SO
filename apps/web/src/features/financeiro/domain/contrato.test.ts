import { describe, expect, it } from "vitest";
import { receitaMensalPrevista, validarContrato } from "./contrato";
import type { ContratoItem } from "./contrato";

const base = {
  clienteId: "cli-1",
  valorMensalCentavos: 100000,
  diaVencimento: 10,
  inicio: "2026-01-01",
  status: "ativo" as const,
  bloqueiaOsEmAtraso: false,
};

describe("validarContrato", () => {
  it("exige cliente", () => {
    expect(() => validarContrato({ ...base, clienteId: "" })).toThrow("Cliente é obrigatório.");
  });

  it("rejeita valor mensal zero", () => {
    expect(() => validarContrato({ ...base, valorMensalCentavos: 0 })).toThrow(
      "Valor mensal deve ser maior que zero.",
    );
  });

  it("rejeita dia de vencimento fora de 1-28", () => {
    expect(() => validarContrato({ ...base, diaVencimento: 29 })).toThrow(
      "Dia de vencimento deve ser entre 1 e 28.",
    );
    expect(() => validarContrato({ ...base, diaVencimento: 0 })).toThrow(
      "Dia de vencimento deve ser entre 1 e 28.",
    );
  });

  it("rejeita fim antes do inicio", () => {
    expect(() => validarContrato({ ...base, fim: "2025-12-31" })).toThrow(
      "Fim não pode ser antes do início.",
    );
  });

  it("aceita contrato valido sem fim", () => {
    const resultado = validarContrato(base);
    expect(resultado.fim).toBeNull();
  });
});

describe("receitaMensalPrevista", () => {
  const contratos: ContratoItem[] = [
    {
      id: "1",
      clienteId: "a",
      descricao: null,
      valorMensalCentavos: 1000,
      diaVencimento: 5,
      inicio: "2026-01-01",
      fim: null,
      status: "ativo",
      bloqueiaOsEmAtraso: false,
    },
    {
      id: "2",
      clienteId: "b",
      descricao: null,
      valorMensalCentavos: 2000,
      diaVencimento: 5,
      inicio: "2026-01-01",
      fim: null,
      status: "suspenso",
      bloqueiaOsEmAtraso: false,
    },
    {
      id: "3",
      clienteId: "c",
      descricao: null,
      valorMensalCentavos: 500,
      diaVencimento: 5,
      inicio: "2026-01-01",
      fim: null,
      status: "ativo",
      bloqueiaOsEmAtraso: false,
    },
  ];

  it("soma só contratos ativos", () => {
    expect(receitaMensalPrevista(contratos)).toBe(1500);
  });

  it("lista vazia soma zero", () => {
    expect(receitaMensalPrevista([])).toBe(0);
  });
});
