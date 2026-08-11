import { describe, expect, it } from "vitest";
import {
  agruparAlocacoesPorTecnico,
  agruparPorDia,
  corDoTecnico,
  diasDaSemana,
  semanaAnterior,
  semanaSeguinte,
  validarAlocacao,
} from "./agenda-tecnico";
import type { AlocacaoTecnico } from "./agenda-tecnico";

describe("diasDaSemana", () => {
  it("normaliza pra segunda-feira e retorna 6 dias (seg-sáb)", () => {
    // 2026-07-30 é quinta-feira
    const dias = diasDaSemana(new Date("2026-07-30T12:00:00Z"));
    expect(dias).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
  });

  it("domingo normaliza pra segunda da mesma semana (não da seguinte)", () => {
    const dias = diasDaSemana(new Date("2026-08-02T12:00:00Z")); // domingo
    expect(dias[0]).toBe("2026-07-27");
  });
});

describe("semanaAnterior / semanaSeguinte", () => {
  it("navega 7 dias", () => {
    const base = new Date("2026-07-30T00:00:00Z");
    expect(semanaAnterior(base).toISOString().slice(0, 10)).toBe("2026-07-23");
    expect(semanaSeguinte(base).toISOString().slice(0, 10)).toBe("2026-08-06");
  });
});

describe("agruparPorDia", () => {
  const dias = ["2026-07-27", "2026-07-28"];
  const alocacoes: AlocacaoTecnico[] = [
    {
      id: "1",
      funcionarioId: "f1",
      funcionarioNome: "Weslei",
      clienteId: "c1",
      clienteNome: "I Home",
      data: "2026-07-27",
      horaInicio: "14:00",
      horaFim: null,
    },
    {
      id: "2",
      funcionarioId: "f2",
      funcionarioNome: "Davi",
      clienteId: "c2",
      clienteNome: "Living Elegance",
      data: "2026-07-27",
      horaInicio: "08:00",
      horaFim: null,
    },
  ];

  it("agrupa por dia e ordena por hora", () => {
    const mapa = agruparPorDia(alocacoes, dias);
    expect(mapa.get("2026-07-27")?.map((a) => a.funcionarioNome)).toEqual(["Davi", "Weslei"]);
    expect(mapa.get("2026-07-28")).toEqual([]);
  });
});

describe("agruparAlocacoesPorTecnico", () => {
  const dias = ["2026-07-27", "2026-07-28"];
  const alocacoes: AlocacaoTecnico[] = [
    {
      id: "1",
      funcionarioId: "f1",
      funcionarioNome: "Weslei",
      clienteId: "c1",
      clienteNome: "I Home",
      data: "2026-07-27",
      horaInicio: "14:00",
      horaFim: null,
    },
    {
      id: "2",
      funcionarioId: "f2",
      funcionarioNome: "Davi",
      clienteId: "c2",
      clienteNome: "Living Elegance",
      data: "2026-07-28",
      horaInicio: "08:00",
      horaFim: null,
    },
    {
      id: "3",
      funcionarioId: "f1",
      funcionarioNome: "Weslei",
      clienteId: "c3",
      clienteNome: "Aldo Cardarelli",
      data: "2026-07-27",
      horaInicio: "08:00",
      horaFim: null,
    },
  ];

  it("uma linha por técnico com alocação, ordenada por nome", () => {
    const linhas = agruparAlocacoesPorTecnico(alocacoes, dias);
    expect(linhas.map((l) => l.funcionarioNome)).toEqual(["Davi", "Weslei"]);
  });

  it("célula do dia ordena por horário", () => {
    const linhas = agruparAlocacoesPorTecnico(alocacoes, dias);
    const weslei = linhas.find((l) => l.funcionarioNome === "Weslei");
    expect(weslei?.porDia.get("2026-07-27")?.map((a) => a.clienteNome)).toEqual([
      "Aldo Cardarelli",
      "I Home",
    ]);
  });

  it("dia sem alocação vem vazio, não ausente", () => {
    const linhas = agruparAlocacoesPorTecnico(alocacoes, dias);
    const davi = linhas.find((l) => l.funcionarioNome === "Davi");
    expect(davi?.porDia.get("2026-07-27")).toEqual([]);
  });

  it("técnico sem nenhuma alocação na semana não gera linha", () => {
    const linhas = agruparAlocacoesPorTecnico(alocacoes, dias);
    expect(linhas.some((l) => l.funcionarioId === "f3")).toBe(false);
  });
});

describe("corDoTecnico", () => {
  it("é determinística (mesmo id sempre a mesma cor)", () => {
    expect(corDoTecnico("f1")).toBe(corDoTecnico("f1"));
  });
});

describe("validarAlocacao", () => {
  it("exige técnico, cliente e data", () => {
    expect(() =>
      validarAlocacao({ funcionarioId: "", clienteId: "c1", data: "2026-07-27" }),
    ).toThrow(/Técnico/);
    expect(() =>
      validarAlocacao({ funcionarioId: "f1", clienteId: "", data: "2026-07-27" }),
    ).toThrow(/Cliente/);
    expect(() => validarAlocacao({ funcionarioId: "f1", clienteId: "c1", data: "" })).toThrow(
      /Data/,
    );
  });

  it("horário de início/fim são opcionais", () => {
    expect(validarAlocacao({ funcionarioId: "f1", clienteId: "c1", data: "2026-07-27" })).toEqual({
      funcionarioId: "f1",
      clienteId: "c1",
      data: "2026-07-27",
      horaInicio: null,
      horaFim: null,
    });
  });

  it("aceita só início preenchido", () => {
    expect(
      validarAlocacao({
        funcionarioId: "f1",
        clienteId: "c1",
        data: "2026-07-27",
        horaInicio: "08:00",
      }),
    ).toMatchObject({ horaInicio: "08:00", horaFim: null });
  });

  it("rejeita fim antes do início", () => {
    expect(() =>
      validarAlocacao({
        funcionarioId: "f1",
        clienteId: "c1",
        data: "2026-07-27",
        horaInicio: "14:00",
        horaFim: "08:00",
      }),
    ).toThrow(/fim não pode ser antes do início/);
  });

  it("aceita fim igual ao início", () => {
    expect(
      validarAlocacao({
        funcionarioId: "f1",
        clienteId: "c1",
        data: "2026-07-27",
        horaInicio: "08:00",
        horaFim: "08:00",
      }),
    ).toMatchObject({ horaInicio: "08:00", horaFim: "08:00" });
  });

  it("rejeita fim sem início", () => {
    expect(() =>
      validarAlocacao({
        funcionarioId: "f1",
        clienteId: "c1",
        data: "2026-07-27",
        horaFim: "18:00",
      }),
    ).toThrow(/início.*junto com.*fim/);
  });
});
