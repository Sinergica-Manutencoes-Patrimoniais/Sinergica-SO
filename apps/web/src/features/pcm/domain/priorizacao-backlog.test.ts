import { describe, expect, it } from "vitest";
import {
  SCORE_GUT_MAX,
  SCORE_GUT_MIN,
  calcularScoreGut,
  classificarPrioridade,
  ordenarPorPrioridade,
} from "./priorizacao-backlog";

// specs/0001-priorizacao-backlog-gut — AC-1, AC-2, AC-3, AC-4

describe("calcularScoreGut", () => {
  // AC-1: fatores válidos produzem o produto correto
  it("AC-1: calcula gravidade × urgência × tendência", () => {
    expect(calcularScoreGut(5, 5, 5)).toBe(125);
    expect(calcularScoreGut(1, 1, 1)).toBe(1);
    expect(calcularScoreGut(3, 4, 2)).toBe(24);
  });

  it("AC-1: score mínimo e máximo são 1 e 125", () => {
    expect(calcularScoreGut(1, 1, 1)).toBe(SCORE_GUT_MIN);
    expect(calcularScoreGut(5, 5, 5)).toBe(SCORE_GUT_MAX);
  });

  // AC-2: fator fora de [1,5] ou não inteiro é rejeitado
  it("AC-2: rejeita fator = 0 (abaixo do mínimo)", () => {
    expect(() => calcularScoreGut(0, 3, 3)).toThrow(RangeError);
  });

  it("AC-2: rejeita fator = 6 (acima do máximo)", () => {
    expect(() => calcularScoreGut(3, 6, 3)).toThrow(RangeError);
  });

  it("AC-2: rejeita fator não inteiro", () => {
    expect(() => calcularScoreGut(1.5, 3, 3)).toThrow(RangeError);
    expect(() => calcularScoreGut(3, 3, 2.9)).toThrow(RangeError);
  });

  it("AC-2: mensagem de erro identifica o fator problemático", () => {
    expect(() => calcularScoreGut(3, 0, 3)).toThrow(/urgencia/);
  });
});

describe("classificarPrioridade", () => {
  // AC-3: faixas de prioridade
  it("AC-3: score >= 100 é crítica", () => {
    expect(classificarPrioridade(100)).toBe("critica");
    expect(classificarPrioridade(125)).toBe("critica");
  });

  it("AC-3: score >= 50 e < 100 é alta", () => {
    expect(classificarPrioridade(50)).toBe("alta");
    expect(classificarPrioridade(99)).toBe("alta");
  });

  it("AC-3: score >= 20 e < 50 é média", () => {
    expect(classificarPrioridade(20)).toBe("media");
    expect(classificarPrioridade(49)).toBe("media");
  });

  it("AC-3: score < 20 é baixa", () => {
    expect(classificarPrioridade(1)).toBe("baixa");
    expect(classificarPrioridade(19)).toBe("baixa");
  });

  it("AC-3: score inválido (0 ou >125) é rejeitado", () => {
    expect(() => classificarPrioridade(0)).toThrow(RangeError);
    expect(() => classificarPrioridade(126)).toThrow(RangeError);
  });
});

describe("ordenarPorPrioridade", () => {
  // AC-4: backlog ordenado por score desc, estável (empate preserva ordem)
  it("AC-4: ordena do maior para o menor score", () => {
    const itens = [
      { id: "a", score: 24 },
      { id: "b", score: 100 },
      { id: "c", score: 50 },
    ];
    const resultado = ordenarPorPrioridade(itens);
    expect(resultado.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("AC-4: empate preserva ordem de entrada (sort estável)", () => {
    const itens = [
      { id: "primeiro", score: 60 },
      { id: "segundo", score: 60 },
      { id: "terceiro", score: 60 },
    ];
    const resultado = ordenarPorPrioridade(itens);
    expect(resultado.map((i) => i.id)).toEqual(["primeiro", "segundo", "terceiro"]);
  });

  it("AC-4: não muta o array original", () => {
    const itens = [
      { id: "a", score: 10 },
      { id: "b", score: 100 },
    ];
    const original = [...itens];
    ordenarPorPrioridade(itens);
    expect(itens).toEqual(original);
  });

  it("AC-4: lista vazia retorna lista vazia", () => {
    expect(ordenarPorPrioridade([])).toEqual([]);
  });
});
