import { describe, expect, it } from "vitest";
import {
  janelaPadraoCalendario,
  preverMudancaDiaContratual,
  projetarVencimentosPorCalendario,
  projetarVisitasContratuais,
} from "./calendario-contratual";

const regra = {
  ancoraSemana: "2026-10-05",
  vigenciaInicio: "2026-10-01",
  vigenciaFim: null,
  diaSemana: 5,
  intervaloSemanas: 1,
};

describe("prévia de Visitas contratuais", () => {
  it("recusa janela extensa antes de acumular milhares de visitas", () => {
    expect(() =>
      projetarVisitasContratuais({
        regra,
        inicio: "2026-10-05",
        fim: "2500-12-31",
        feriados: [],
        visitasProtegidas: [],
      }),
    ).toThrow(/janela extensa/i);
  });
  it("suprime sexta em feriado sem propor visita ou reposição", () => {
    const resultado = projetarVisitasContratuais({
      regra,
      inicio: "2026-10-05",
      fim: "2026-10-18",
      feriados: ["2026-10-09"],
      visitasProtegidas: [],
    });
    expect(resultado.propostas).toEqual([{ semana: "2026-10-12", data: "2026-10-16" }]);
    expect(resultado.supressoes).toEqual([
      { semana: "2026-10-05", data: "2026-10-09", motivo: "feriado" },
    ]);
    expect(resultado.visitasPreservadas).toEqual([]);
  });
  it("mantém visitas confirmadas, reprogramadas e extras ao aplicar novo dia futuro", () => {
    const visitasProtegidas = [
      {
        id: "confirmada",
        tipo: "contratual" as const,
        semanaOrigem: "2026-10-05",
        data: "2026-10-09",
        estado: "confirmada" as const,
        auvoId: "task-1",
      },
      {
        id: "movida",
        tipo: "contratual" as const,
        semanaOrigem: "2026-10-12",
        data: "2026-10-14",
        estado: "reprogramada" as const,
        auvoId: null,
      },
      {
        id: "extra",
        tipo: "extra" as const,
        semanaOrigem: null,
        data: "2026-10-20",
        estado: "confirmada" as const,
        auvoId: "task-2",
      },
    ];
    const resultado = projetarVisitasContratuais({
      regra: { ...regra, diaSemana: 2, vigenciaInicio: "2026-10-13" },
      inicio: "2026-10-01",
      fim: "2026-10-31",
      feriados: [],
      visitasProtegidas,
    });
    expect(resultado.visitasPreservadas).toEqual(visitasProtegidas);
    expect(resultado.propostas).toEqual([
      { semana: "2026-10-19", data: "2026-10-20" },
      { semana: "2026-10-26", data: "2026-10-27" },
    ]);
  });
  it("preserva exceção aprovada em semana de feriado", () => {
    const protegida = {
      id: "excecao",
      tipo: "contratual" as const,
      semanaOrigem: "2026-10-05",
      data: "2026-10-09",
      estado: "excecao_aprovada" as const,
      auvoId: null,
    };
    const resultado = projetarVisitasContratuais({
      regra,
      inicio: "2026-10-05",
      fim: "2026-10-11",
      feriados: ["2026-10-09"],
      visitasProtegidas: [protegida],
    });
    expect(resultado.visitasPreservadas).toEqual([protegida]);
    expect(resultado.propostas).toEqual([]);
    expect(resultado.supressoes).toEqual([]);
  });
  it("não propõe Visita antes da vigência sem tratar a janela como inválida", () => {
    const resultado = projetarVisitasContratuais({
      regra: { ...regra, vigenciaInicio: "2026-11-01" },
      inicio: "2026-10-01",
      fim: "2026-10-31",
      feriados: [],
      visitasProtegidas: [],
    });
    expect(resultado.propostas).toEqual([]);
    expect(resultado.supressoes).toEqual([]);
  });
  it("mantém intervalo contratual ancorado mesmo após semana suprimida", () => {
    const resultado = projetarVisitasContratuais({
      regra: { ...regra, intervaloSemanas: 2 },
      inicio: "2026-10-01",
      fim: "2026-11-01",
      feriados: ["2026-10-09"],
      visitasProtegidas: [],
    });
    expect(resultado.supressoes).toEqual([
      { semana: "2026-10-05", data: "2026-10-09", motivo: "feriado" },
    ]);
    expect(resultado.propostas).toEqual([{ semana: "2026-10-19", data: "2026-10-23" }]);
  });
  it("valida datas e referência semanal em vez de normalizar entradas inválidas", () => {
    expect(() =>
      projetarVisitasContratuais({
        regra: { ...regra, ancoraSemana: "2026-10-06" },
        inicio: "2026-10-01",
        fim: "2026-10-31",
        feriados: [],
        visitasProtegidas: [],
      }),
    ).toThrow();
    expect(() =>
      projetarVisitasContratuais({
        regra,
        inicio: "2026-02-30",
        fim: "2026-10-31",
        feriados: [],
        visitasProtegidas: [],
      }),
    ).toThrow();
  });
});

describe("prévia de mudança contratual", () => {
  it("compara sexta e terça futuras preservando Visitas confirmadas, reprogramadas e extras", () => {
    const protegidas = [
      {
        id: "confirmada",
        tipo: "contratual" as const,
        semanaOrigem: "2026-10-05",
        data: "2026-10-09",
        estado: "confirmada" as const,
        auvoId: "task-1",
      },
      {
        id: "movida",
        tipo: "contratual" as const,
        semanaOrigem: "2026-10-26",
        data: "2026-10-29",
        estado: "reprogramada" as const,
        auvoId: "task-2",
      },
      {
        id: "extra",
        tipo: "extra" as const,
        semanaOrigem: null,
        data: "2026-10-20",
        estado: "confirmada" as const,
        auvoId: null,
      },
    ];
    const resultado = preverMudancaDiaContratual({
      regraAtual: regra,
      novoDiaSemana: 2,
      vigencia: "2026-10-13",
      hoje: "2026-10-10",
      inicio: "2026-10-05",
      fim: "2026-10-31",
      feriados: [],
      visitasProtegidas: protegidas,
    });
    expect(resultado.visitasPreservadas).toEqual(protegidas);
    expect(resultado.impactos).toEqual([
      {
        semana: "2026-10-12",
        classificacao: "alterada",
        antes: { data: "2026-10-16", situacao: "prevista" },
        depois: { data: "2026-10-13", situacao: "prevista" },
      },
      {
        semana: "2026-10-19",
        classificacao: "alterada",
        antes: { data: "2026-10-23", situacao: "prevista" },
        depois: { data: "2026-10-20", situacao: "prevista" },
      },
    ]);
    expect(resultado.efeitosOperacionaisPendentes).toBe(true);
  });
  it("não cria reposição na mesma semana quando regra anterior já foi suprimida", () => {
    const resultado = preverMudancaDiaContratual({
      regraAtual: { ...regra, diaSemana: 2 },
      novoDiaSemana: 5,
      vigencia: "2026-10-07",
      hoje: "2026-10-05",
      inicio: "2026-10-05",
      fim: "2026-10-11",
      feriados: ["2026-10-06"],
      visitasProtegidas: [],
    });
    expect(resultado.impactos).toEqual([
      {
        semana: "2026-10-05",
        classificacao: "inalterada",
        antes: { data: "2026-10-06", situacao: "suprimida" },
        depois: { data: "2026-10-06", situacao: "suprimida" },
      },
    ]);
  });
  it("não propõe reposição quando a data anterior está fora da janela consultada", () => {
    const resultado = preverMudancaDiaContratual({
      regraAtual: { ...regra, diaSemana: 2 },
      novoDiaSemana: 5,
      vigencia: "2026-10-07",
      hoje: "2026-10-05",
      inicio: "2026-10-08",
      fim: "2026-10-11",
      feriados: ["2026-10-06"],
      visitasProtegidas: [],
    });
    expect(resultado.impactos).toEqual([]);
  });
  it("não propõe reposição de ciclo anterior mesmo após a data de hoje", () => {
    const resultado = preverMudancaDiaContratual({
      regraAtual: { ...regra, diaSemana: 2 },
      novoDiaSemana: 5,
      vigencia: "2026-10-08",
      hoje: "2026-10-08",
      inicio: "2026-10-05",
      fim: "2026-10-11",
      feriados: [],
      visitasProtegidas: [],
    });
    expect(resultado.impactos).toEqual([]);
  });
  it("não inventa Visita anterior à vigência quando o novo dia já passou", () => {
    const resultado = preverMudancaDiaContratual({
      regraAtual: regra,
      novoDiaSemana: 2,
      vigencia: "2026-10-07",
      hoje: "2026-10-05",
      inicio: "2026-10-05",
      fim: "2026-10-11",
      feriados: [],
      visitasProtegidas: [],
    });
    expect(resultado.impactos).toEqual([
      {
        semana: "2026-10-05",
        classificacao: "retirada",
        antes: { data: "2026-10-09", situacao: "prevista" },
        depois: null,
      },
    ]);
  });
  it("recusa vigência retroativa", () => {
    expect(() =>
      preverMudancaDiaContratual({
        regraAtual: regra,
        novoDiaSemana: 2,
        vigencia: "2026-10-01",
        hoje: "2026-10-02",
        inicio: "2026-10-01",
        fim: "2026-10-31",
        feriados: [],
        visitasProtegidas: [],
      }),
    ).toThrow();
  });
  it("valida novo dia mesmo quando a janela consultada já passou", () => {
    expect(() =>
      preverMudancaDiaContratual({
        regraAtual: regra,
        novoDiaSemana: 8,
        vigencia: "2026-12-01",
        hoje: "2026-11-01",
        inicio: "2026-10-01",
        fim: "2026-10-31",
        feriados: [],
        visitasProtegidas: [],
      }),
    ).toThrow();
  });
});

describe("prévia de vencimentos por calendário", () => {
  it("considera o trigésimo dia no limite inclusivo da janela padrão", () => {
    expect(janelaPadraoCalendario("2026-10-01")).toEqual({
      inicio: "2026-10-01",
      fim: "2026-10-31",
    });
  });
  it("mantém vencimento em feriado e ciclos futuros na âncora de 31 de janeiro", () => {
    const resultado = projetarVencimentosPorCalendario({
      dataBase: "2024-01-31",
      intervalo: 1,
      unidade: "meses",
      inicio: "2024-02-01",
      fim: "2024-04-30",
      feriados: ["2024-02-29"],
    });
    expect(resultado).toEqual([
      { ciclo: 1, vencimento: "2024-02-29", feriado: true },
      { ciclo: 2, vencimento: "2024-03-31", feriado: false },
      { ciclo: 3, vencimento: "2024-04-30", feriado: false },
    ]);
  });
  it("mantém referência de 29 de fevereiro para anos bissextos futuros", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2024-02-29",
        intervalo: 1,
        unidade: "anos",
        inicio: "2025-01-01",
        fim: "2028-12-31",
        feriados: [],
      }),
    ).toEqual([
      { ciclo: 1, vencimento: "2025-02-28", feriado: false },
      { ciclo: 2, vencimento: "2026-02-28", feriado: false },
      { ciclo: 3, vencimento: "2027-02-28", feriado: false },
      { ciclo: 4, vencimento: "2028-02-29", feriado: false },
    ]);
  });
  it("distingue dias e semanas e inclui limites da janela", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2026-10-01",
        intervalo: 7,
        unidade: "dias",
        inicio: "2026-10-08",
        fim: "2026-10-15",
        feriados: [],
      }),
    ).toEqual([
      { ciclo: 1, vencimento: "2026-10-08", feriado: false },
      { ciclo: 2, vencimento: "2026-10-15", feriado: false },
    ]);
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2026-10-01",
        intervalo: 2,
        unidade: "semanas",
        inicio: "2026-10-01",
        fim: "2026-10-15",
        feriados: [],
      }).map((x) => x.vencimento),
    ).toEqual(["2026-10-01", "2026-10-15"]);
  });
  it("rejeita intervalo ou data inexistente em vez de corrigir silenciosamente", () => {
    const entrada = {
      dataBase: "2026-01-31",
      intervalo: 1,
      unidade: "meses" as const,
      inicio: "2026-01-01",
      fim: "2026-12-31",
      feriados: [],
    };
    expect(() => projetarVencimentosPorCalendario({ ...entrada, intervalo: 0 })).toThrow();
    expect(() =>
      projetarVencimentosPorCalendario({ ...entrada, dataBase: "2026-02-30" }),
    ).toThrow();
  });
  it("respeita século não bissexto e não gera ciclos antes da data-base", () => {
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2096-02-29",
        intervalo: 1,
        unidade: "anos",
        inicio: "2100-01-01",
        fim: "2100-12-31",
        feriados: [],
      }),
    ).toEqual([{ ciclo: 4, vencimento: "2100-02-28", feriado: false }]);
    expect(
      projetarVencimentosPorCalendario({
        dataBase: "2027-01-01",
        intervalo: 1,
        unidade: "meses",
        inicio: "2026-01-01",
        fim: "2026-12-31",
        feriados: [],
      }),
    ).toEqual([]);
  });
});
