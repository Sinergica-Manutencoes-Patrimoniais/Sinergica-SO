import { describe, expect, it } from "vitest";
import { pendenciasConhecidasRotina } from "./plano-manutencao";

describe("S165 US2: pré-condições locais", () => {
  it("reconhece questionário como alternativa à instrução", () => {
    expect(pendenciasConhecidasRotina({ modo: "visita", intervalo: 1, dataBase: null, tempoMinutos: 10, tipoTempo: "total", instrucao: null, questionarioId: "q1" })).toEqual([]);
  });
  it("expõe ausência de recorrência e data-base para calendário", () => {
    expect(pendenciasConhecidasRotina({ modo: "calendario", intervalo: null, dataBase: null, tempoMinutos: 10, tipoTempo: "total", instrucao: "Conferir", questionarioId: null })).toEqual(expect.arrayContaining(["recorrencia", "data_base"]));
  });
});
