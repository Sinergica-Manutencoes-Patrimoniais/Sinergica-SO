import { describe, expect, it } from "vitest";
import {
  type AlocacaoProjetada,
  FRASE_PROJECAO_INDISPONIVEL,
  FRASE_SEMANA_SEM_VISITA,
  agruparProjecaoPorDia,
  agruparProjecaoPorTecnico,
  inicioSemanaIso,
  motivoDoErroProjecao,
} from "./agenda-projecao-visita";

function alocacao(parcial: Partial<AlocacaoProjetada>): AlocacaoProjetada {
  return {
    visitaId: "v1",
    clienteId: "c1",
    clienteNome: "Cliente A",
    funcionarioId: "f1",
    funcionarioNome: "Ana",
    papel: "Técnica",
    data: "2026-11-23",
    periodo: "manha",
    horariosAuvo: [],
    estado: "planejada",
    natureza: "regular",
    osNumeros: [],
    quantidadeOs: 0,
    ...parcial,
  };
}

const SEMANA = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"];

describe("E01-S202 — agenda do técnico projetada da Visita", () => {
  it("AC-9: a semana sempre começa na segunda-feira, venha a referência de que dia vier", () => {
    expect(inicioSemanaIso(new Date(2026, 10, 23))).toBe("2026-11-23"); // segunda
    expect(inicioSemanaIso(new Date(2026, 10, 25))).toBe("2026-11-23"); // quarta
    expect(inicioSemanaIso(new Date(2026, 10, 29))).toBe("2026-11-23"); // domingo
  });

  it("AC-1: semana com Visita produz linha de técnico — é a evidência do cliente, invertida", () => {
    const linhas = agruparProjecaoPorTecnico(
      [
        alocacao({ visitaId: "v1", osNumeros: ["OS-1", "OS-2"], quantidadeOs: 2 }),
        alocacao({ visitaId: "v2", data: "2026-11-25", periodo: "tarde" }),
      ],
      SEMANA,
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.porDia.get("2026-11-23")).toHaveLength(1);
    expect(linhas[0]?.porDia.get("2026-11-25")).toHaveLength(1);
    expect(linhas[0]?.porDia.get("2026-11-24")).toHaveLength(0);
  });

  it("AC-2: a alocação carrega as OS vinculadas da Visita, sem união posterior", () => {
    const [linha] = agruparProjecaoPorTecnico(
      [alocacao({ osNumeros: ["OS-9", "OS-3"], quantidadeOs: 2 })],
      SEMANA,
    );
    expect(linha?.porDia.get("2026-11-23")?.[0]?.osNumeros).toEqual(["OS-9", "OS-3"]);
  });

  it("AC-3: técnico sem alocação na semana não vira linha vazia", () => {
    expect(agruparProjecaoPorTecnico([], SEMANA)).toEqual([]);
  });

  it("AC-3: técnicos saem em ordem alfabética e cada dia ordena por período", () => {
    const linhas = agruparProjecaoPorTecnico(
      [
        alocacao({ funcionarioId: "f2", funcionarioNome: "Bruno" }),
        alocacao({ funcionarioId: "f1", funcionarioNome: "Ana", periodo: "tarde" }),
        alocacao({ funcionarioId: "f1", funcionarioNome: "Ana", visitaId: "v3", periodo: "manha" }),
      ],
      SEMANA,
    );
    expect(linhas.map((l) => l.funcionarioNome)).toEqual(["Ana", "Bruno"]);
    expect(linhas[0]?.porDia.get("2026-11-23")?.map((a) => a.periodo)).toEqual(["manha", "tarde"]);
  });

  it("AC-8: a visão por dia agrupa pelos mesmos dias da semana", () => {
    const porDia = agruparProjecaoPorDia([alocacao({ data: "2026-11-27" })], SEMANA);
    expect(porDia.get("2026-11-27")).toHaveLength(1);
    expect(porDia.get("2026-11-23")).toHaveLength(0);
  });

  it("AC-6: gate fechado, falta de capacidade e erro genérico têm frases DIFERENTES", () => {
    expect(motivoDoErroProjecao({ message: "agenda_capacidade_bloqueada" })).toBe("gate-fechado");
    expect(motivoDoErroProjecao({ message: "sem_acesso", code: "42501" })).toBe("sem-capacidade");
    expect(motivoDoErroProjecao({ message: "autorizacao_em_alteracao" })).toBe(
      "autorizacao-em-alteracao",
    );
    expect(motivoDoErroProjecao(new Error("boom"))).toBe("erro");

    const frases = [
      FRASE_PROJECAO_INDISPONIVEL["flag-desligada"],
      FRASE_PROJECAO_INDISPONIVEL["gate-fechado"],
      FRASE_PROJECAO_INDISPONIVEL["sem-capacidade"],
      FRASE_PROJECAO_INDISPONIVEL["autorizacao-em-alteracao"],
      FRASE_PROJECAO_INDISPONIVEL.erro,
      FRASE_SEMANA_SEM_VISITA,
    ];
    expect(new Set(frases).size).toBe(frases.length);
  });
});
