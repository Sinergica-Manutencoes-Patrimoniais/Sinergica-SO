import { describe, expect, it } from "vitest";
import { preverMudancaDiaContratual, projetarVisitasContratuais } from "./calendario-contratual";
import type { VisitaProtegida } from "./calendario-contratual";

const protegidas: VisitaProtegida[] = [
  { id: "visita-reprogramada", tipo: "contratual", semanaOrigem: "2026-10-12", data: "2026-10-14", estado: "reprogramada", auvoId: "auvo-1" },
  { id: "visita-extra", tipo: "extra", semanaOrigem: null, data: "2026-10-16", estado: "confirmada", auvoId: "auvo-2" },
];

describe("E01-S166 US1 — projeção e mudança da regra contratual", () => {
  it("suprime apenas a Visita contratual em feriado e preserva extras e reprogramações", () => {
    const previa = projetarVisitasContratuais({
      regra: { ancoraSemana: "2026-10-05", vigenciaInicio: "2026-10-05", vigenciaFim: null, diaSemana: 5, intervaloSemanas: 1 },
      inicio: "2026-10-05", fim: "2026-11-02", feriados: ["2026-10-09"], visitasProtegidas: protegidas,
    });

    expect(previa.supressoes).toEqual([{ semana: "2026-10-05", data: "2026-10-09", motivo: "feriado" }]);
    expect(previa.propostas.map((item) => item.data)).toEqual(["2026-10-23", "2026-10-30"]);
    expect(previa.visitasPreservadas).toEqual(protegidas);
  });

  it("mostra impactos somente a partir da vigência e mantém identidade das Visitas protegidas", () => {
    const previa = preverMudancaDiaContratual({
      regraAtual: { ancoraSemana: "2026-10-05", vigenciaInicio: "2026-10-05", vigenciaFim: null, diaSemana: 5, intervaloSemanas: 1 },
      novoDiaSemana: 2, vigencia: "2026-10-19", hoje: "2026-10-05", inicio: "2026-10-05", fim: "2026-11-02",
      feriados: [], visitasProtegidas: protegidas,
    });

    expect(previa.impactos.find((item) => item.semana === "2026-10-19")).toMatchObject({
      classificacao: "alterada", antes: { data: "2026-10-23", situacao: "prevista" }, depois: { data: "2026-10-20", situacao: "prevista" },
    });
    expect(previa.visitasPreservadas.map((item) => [item.id, item.auvoId])).toEqual([
      ["visita-reprogramada", "auvo-1"], ["visita-extra", "auvo-2"],
    ]);
    expect(previa.efeitosOperacionaisPendentes).toBe(true);
  });

  it("recusa vigência passada, dia igual ou fora da semana civil", () => {
    const base = {
      regraAtual: { ancoraSemana: "2026-10-05", vigenciaInicio: "2026-10-05", vigenciaFim: null, diaSemana: 5, intervaloSemanas: 1 },
      novoDiaSemana: 2, vigencia: "2026-10-19", hoje: "2026-10-05", inicio: "2026-10-05", fim: "2026-11-02",
      feriados: [], visitasProtegidas: [],
    };
    expect(() => preverMudancaDiaContratual({ ...base, vigencia: "2026-10-04" })).toThrow("Vigência da mudança inválida.");
    expect(() => preverMudancaDiaContratual({ ...base, novoDiaSemana: 8 })).toThrow("Vigência da mudança inválida.");
    expect(() => projetarVisitasContratuais({ ...base, regra: { ...base.regraAtual, diaSemana: 0 } })).toThrow("Regra contratual inválida.");
  });
});
