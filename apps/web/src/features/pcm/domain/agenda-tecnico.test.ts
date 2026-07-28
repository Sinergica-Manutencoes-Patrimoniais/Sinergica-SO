import { describe, expect, it } from "vitest";
import {
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
      hora: "14:00",
    },
    {
      id: "2",
      funcionarioId: "f2",
      funcionarioNome: "Davi",
      clienteId: "c2",
      clienteNome: "Living Elegance",
      data: "2026-07-27",
      hora: "08:00",
    },
  ];

  it("agrupa por dia e ordena por hora", () => {
    const mapa = agruparPorDia(alocacoes, dias);
    expect(mapa.get("2026-07-27")?.map((a) => a.funcionarioNome)).toEqual(["Davi", "Weslei"]);
    expect(mapa.get("2026-07-28")).toEqual([]);
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

  it("hora é opcional", () => {
    expect(validarAlocacao({ funcionarioId: "f1", clienteId: "c1", data: "2026-07-27" })).toEqual({
      funcionarioId: "f1",
      clienteId: "c1",
      data: "2026-07-27",
      hora: null,
    });
  });
});
