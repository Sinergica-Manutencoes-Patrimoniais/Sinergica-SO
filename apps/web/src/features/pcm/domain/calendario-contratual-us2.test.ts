import { describe, expect, it } from "vitest";
import {
  avaliarToleranciaCalendario,
  janelaPadraoCalendario,
  projetarVencimentosPorCalendario,
} from "./calendario-contratual";

describe("tolerância por calendário", () => {
  it("usa zero por padrão e mantém vencimento original", () => {
    expect(avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-10-31" })).toEqual({
      vencimento: "2026-10-31",
      inicioPermitido: "2026-10-31",
      fimPermitido: "2026-10-31",
      situacao: "dentro_da_tolerancia",
    });
    expect(
      avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-10-30" }).situacao,
    ).toBe("antes_da_tolerancia");
    expect(
      avaliarToleranciaCalendario({ vencimento: "2026-10-31", data: "2026-11-01" }).situacao,
    ).toBe("apos_a_tolerancia");
  });
  it("aplica limites independentes e inclusivos cruzando meses e anos", () => {
    const regra = { vencimento: "2027-01-01", diasAntes: 2, diasDepois: 4 };
    expect(avaliarToleranciaCalendario({ ...regra, data: "2026-12-30" })).toMatchObject({
      inicioPermitido: "2026-12-30",
      fimPermitido: "2027-01-05",
      situacao: "dentro_da_tolerancia",
    });
    expect(avaliarToleranciaCalendario({ ...regra, data: "2027-01-05" }).situacao).toBe(
      "dentro_da_tolerancia",
    );
    expect(avaliarToleranciaCalendario({ ...regra, data: "2026-12-29" }).situacao).toBe(
      "antes_da_tolerancia",
    );
    expect(avaliarToleranciaCalendario({ ...regra, data: "2027-01-06" }).situacao).toBe(
      "apos_a_tolerancia",
    );
  });
  it("recusa tolerâncias inválidas e datas inexistentes", () => {
    for (const diasAntes of [-1, 0.5, Number.NaN, 2147483648])
      expect(() =>
        avaliarToleranciaCalendario({ vencimento: "2026-01-01", data: "2026-01-01", diasAntes }),
      ).toThrow();
    expect(() =>
      avaliarToleranciaCalendario({ vencimento: "2026-02-30", data: "2026-03-01" }),
    ).toThrow();
    expect(() =>
      avaliarToleranciaCalendario({ vencimento: "2026-01-01", data: "2026-01-01", diasDepois: -1 }),
    ).toThrow();
  });
});

describe("bordas de recorrência por calendário", () => {
  it("preserva âncora anual de 29 de fevereiro em anos não bissextos e 2100", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2096-02-29",
        intervalo: 1,
        unidade: "anos",
        inicio: "2099-01-01",
        fim: "2104-12-31",
        feriados: [],
      }),
    ).toEqual([
      { ciclo: 3, vencimento: "2099-02-28", feriado: false },
      { ciclo: 4, vencimento: "2100-02-28", feriado: false },
      { ciclo: 5, vencimento: "2101-02-28", feriado: false },
      { ciclo: 6, vencimento: "2102-02-28", feriado: false },
      { ciclo: 7, vencimento: "2103-02-28", feriado: false },
      { ciclo: 8, vencimento: "2104-02-29", feriado: false },
    ]);
  });
  it("mantém feriado por calendário e próximo vencimento trimestral ancorado", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2026-12-25",
        intervalo: 3,
        unidade: "meses",
        inicio: "2026-12-25",
        fim: "2027-03-25",
        feriados: ["2026-12-25"],
      }),
    ).toEqual([
      { ciclo: 0, vencimento: "2026-12-25", feriado: true },
      { ciclo: 1, vencimento: "2027-03-25", feriado: false },
    ]);
  });
  it("não cria ciclos antes da âncora e inclui limites da janela", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2026-01-31",
        intervalo: 1,
        unidade: "meses",
        inicio: "2025-12-01",
        fim: "2026-03-31",
        feriados: [],
      }).map((c) => c.vencimento),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("recusa tolerância que transborde datas civis suportadas", () => {
    expect(() =>
      avaliarToleranciaCalendario({ vencimento: "0001-01-01", data: "0001-01-01", diasAntes: 1 }),
    ).toThrow();
    expect(() =>
      avaliarToleranciaCalendario({ vencimento: "9999-12-31", data: "9999-12-31", diasDepois: 1 }),
    ).toThrow();
    expect(() => janelaPadraoCalendario("9999-12-31")).toThrow();
  });
  it("recusa prévia acima de dez mil ciclos sem retornar lista parcial", () => {
    expect(() =>
      projetarVencimentosPorCalendario({
        dataBase: "2000-01-01",
        intervalo: 1,
        unidade: "dias",
        inicio: "2000-01-01",
        fim: "2030-01-01",
        feriados: [],
      }),
    ).toThrow(/extensa/i);
  });
  it("aceita exatamente dez mil ciclos na janela inclusiva", () => {
    const ciclos = projetarVencimentosPorCalendario({
      dataBase: "2000-01-01",
      intervalo: 1,
      unidade: "dias",
      inicio: "2000-01-01",
      fim: "2027-05-18",
      feriados: [],
    });
    expect(ciclos).toHaveLength(10000);
    expect(ciclos.at(-1)).toEqual({ ciclo: 9999, vencimento: "2027-05-18", feriado: false });
  });
});
