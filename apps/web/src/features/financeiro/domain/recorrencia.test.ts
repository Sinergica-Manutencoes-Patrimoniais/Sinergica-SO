import { describe, expect, it } from "vitest";
import type { ContratoItem } from "./contrato";
import {
  calcularVencimentoRecorrencia,
  contarVigentes,
  contratoVigenteNaCompetencia,
} from "./recorrencia";

describe("contratoVigenteNaCompetencia", () => {
  it("contrato ativo dentro da vigencia esta vigente", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "ativo", inicio: "2026-01-01", fim: null },
        "2026-07-15",
      ),
    ).toBe(true);
  });

  it("contrato suspenso nunca esta vigente", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "suspenso", inicio: "2026-01-01", fim: null },
        "2026-07-15",
      ),
    ).toBe(false);
  });

  it("contrato que comeca no meio do mes seguinte nao esta vigente ainda", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "ativo", inicio: "2026-08-15", fim: null },
        "2026-07-01",
      ),
    ).toBe(false);
  });

  it("contrato que comeca no meio do mes da competencia esta vigente", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "ativo", inicio: "2026-07-15", fim: null },
        "2026-07-01",
      ),
    ).toBe(true);
  });

  it("contrato que termina no meio do mes da competencia ainda esta vigente", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "ativo", inicio: "2026-01-01", fim: "2026-07-15" },
        "2026-07-20",
      ),
    ).toBe(true);
  });

  it("contrato encerrado antes do mes da competencia nao esta vigente", () => {
    expect(
      contratoVigenteNaCompetencia(
        { status: "ativo", inicio: "2026-01-01", fim: "2026-06-15" },
        "2026-07-01",
      ),
    ).toBe(false);
  });
});

describe("calcularVencimentoRecorrencia", () => {
  it("calcula vencimento no dia do contrato dentro do mes da competencia", () => {
    expect(calcularVencimentoRecorrencia("2026-07-01", 10)).toBe("2026-07-10");
  });
});

describe("contarVigentes", () => {
  it("conta so os vigentes na competencia", () => {
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
        valorMensalCentavos: 1000,
        diaVencimento: 5,
        inicio: "2026-01-01",
        fim: null,
        status: "encerrado",
        bloqueiaOsEmAtraso: false,
      },
    ];
    expect(contarVigentes(contratos, "2026-07-01")).toBe(1);
  });
});
