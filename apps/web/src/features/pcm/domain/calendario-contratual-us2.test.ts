import { describe, expect, it } from "vitest";
import { avaliarToleranciaCalendario, janelaPadraoCalendario, projetarVencimentosPorCalendario } from "./calendario-contratual";

describe("E01-S166 US2 — ciclos, vencimentos e tolerância", () => {
  it("calcula meses a partir da âncora, limita fim de mês e mantém ciclos estáveis", () => {
    const vencimentos = projetarVencimentosPorCalendario({
      dataBase: "2027-01-31", intervalo: 1, unidade: "meses", inicio: "2027-01-01", fim: "2027-03-31", feriados: ["2027-02-28"],
    });

    expect(vencimentos).toEqual([
      { ciclo: 0, vencimento: "2027-01-31", feriado: false },
      { ciclo: 1, vencimento: "2027-02-28", feriado: true },
      { ciclo: 2, vencimento: "2027-03-31", feriado: false },
    ]);
    expect(projetarVencimentosPorCalendario({
      dataBase: "2028-01-31", intervalo: 1, unidade: "meses", inicio: "2028-02-01", fim: "2028-02-29", feriados: [],
    })).toEqual([{ ciclo: 1, vencimento: "2028-02-29", feriado: false }]);
  });

  it("projeta intervalos explícitos em dias, semanas e anos sem deslocar a âncora", () => {
    expect(projetarVencimentosPorCalendario({
      dataBase: "2027-12-30", intervalo: 3, unidade: "dias", inicio: "2028-01-01", fim: "2028-01-09", feriados: [],
    })).toEqual([
      { ciclo: 1, vencimento: "2028-01-02", feriado: false },
      { ciclo: 2, vencimento: "2028-01-05", feriado: false },
      { ciclo: 3, vencimento: "2028-01-08", feriado: false },
    ]);
    expect(projetarVencimentosPorCalendario({
      dataBase: "2027-12-20", intervalo: 2, unidade: "semanas", inicio: "2028-01-01", fim: "2028-01-20", feriados: [],
    })).toEqual([
      { ciclo: 1, vencimento: "2028-01-03", feriado: false },
      { ciclo: 2, vencimento: "2028-01-17", feriado: false },
    ]);
    expect(projetarVencimentosPorCalendario({
      dataBase: "2027-02-28", intervalo: 1, unidade: "anos", inicio: "2027-01-01", fim: "2029-12-31", feriados: [],
    })).toEqual([
      { ciclo: 0, vencimento: "2027-02-28", feriado: false },
      { ciclo: 1, vencimento: "2028-02-28", feriado: false },
      { ciclo: 2, vencimento: "2029-02-28", feriado: false },
    ]);
  });

  it("mantém janela inclusiva de 30 dias e não desloca data-base por tolerância", () => {
    expect(janelaPadraoCalendario("2026-10-01")).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-10-31" })).toEqual({
      vencimento: "2026-10-31", inicioPermitido: "2026-10-31", fimPermitido: "2026-10-31", situacao: "dentro_da_tolerancia",
    });
    expect(avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-11-02", diasAntes: 3, diasDepois: 2 })).toMatchObject({
      vencimento: "2026-10-31", inicioPermitido: "2026-10-28", fimPermitido: "2026-11-02", situacao: "dentro_da_tolerancia",
    });
    expect(avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-11-03", diasDepois: 2 }).situacao).toBe("apos_a_tolerancia");
  });

  it("rejeita data, recorrência e tolerância fora dos limites", () => {
    expect(() => projetarVencimentosPorCalendario({ dataBase: "2027-02-29", intervalo: 1, unidade: "meses", inicio: "2027-01-01", fim: "2027-12-31", feriados: [] })).toThrow("Data inválida.");
    expect(() => projetarVencimentosPorCalendario({ dataBase: "2027-01-01", intervalo: 0, unidade: "semanas", inicio: "2027-01-01", fim: "2027-12-31", feriados: [] })).toThrow("Recorrência inválida.");
    expect(() => avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-10-31", diasAntes: -1 })).toThrow("Tolerância inválida.");
  });
});
