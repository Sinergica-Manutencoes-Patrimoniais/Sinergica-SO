import { describe, expect, it } from "vitest";
import {
  PESOS_GUTD_PADRAO,
  SCORE_GUT_MAX,
  SCORE_GUT_MIN,
  calcularScoreGut,
  calcularScoreGutd,
  classificarPrioridade,
  classificarPrioridadeGutd,
  ordenarPorPrioridade,
  validarPesosGutd,
} from "./priorizacao-backlog";
import type { PesosGutd } from "./priorizacao-backlog";

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

// E01-S82 — GUTD (spec.md AC-1..AC-4, matriz de decisão)
describe("validarPesosGutd", () => {
  it("AC-3: aceita pesos que somam exatamente 100", () => {
    expect(validarPesosGutd(PESOS_GUTD_PADRAO)).toBe(PESOS_GUTD_PADRAO);
    expect(
      validarPesosGutd({ gravidade: 50, urgencia: 0, tendencia: 0, dorCliente: 50 }),
    ).toBeTruthy();
  });

  it("AC-3: rejeita soma diferente de 100 (bloqueia salvar)", () => {
    expect(() =>
      validarPesosGutd({ gravidade: 30, urgencia: 30, tendencia: 30, dorCliente: 30 }),
    ).toThrow(/somar 100%/);
    expect(() =>
      validarPesosGutd({ gravidade: 20, urgencia: 20, tendencia: 20, dorCliente: 20 }),
    ).toThrow();
  });

  it("rejeita peso negativo ou não inteiro", () => {
    expect(() =>
      validarPesosGutd({ gravidade: -10, urgencia: 30, tendencia: 40, dorCliente: 40 }),
    ).toThrow();
    expect(() =>
      validarPesosGutd({ gravidade: 25.5, urgencia: 25, tendencia: 24.5, dorCliente: 25 }),
    ).toThrow();
  });
});

describe("calcularScoreGutd", () => {
  // Matriz de decisão da spec (linha 1): 25/25/25/25, G=5 U=5 T=5 D=1 -> 4.0
  it("matriz de decisão linha 1: pesos iguais", () => {
    expect(calcularScoreGutd(5, 5, 5, 1, PESOS_GUTD_PADRAO)).toBeCloseTo(4.0, 6);
  });

  // Matriz de decisão da spec (linha 2): 50/0/0/50, G=4 U=1 T=1 D=5 -> 4.5
  it("matriz de decisão linha 2: pesos concentrados em G e D", () => {
    const pesos: PesosGutd = { gravidade: 50, urgencia: 0, tendencia: 0, dorCliente: 50 };
    expect(calcularScoreGutd(4, 1, 1, 5, pesos)).toBeCloseTo(4.5, 6);
  });

  it("AC-4: D ausente redistribui o peso entre G/U/T (retrocompat, não penaliza nem infla)", () => {
    // Só GUT, pesos iguais: score = média simples de G/U/T (peso de D removido, redistribuído).
    expect(calcularScoreGutd(4, 4, 4, null, PESOS_GUTD_PADRAO)).toBeCloseTo(4.0, 6);
    expect(calcularScoreGutd(2, 3, 4, null, PESOS_GUTD_PADRAO)).toBeCloseTo(3.0, 6);
  });

  it("rejeita fator fora de [1,5]", () => {
    expect(() => calcularScoreGutd(0, 3, 3, 3, PESOS_GUTD_PADRAO)).toThrow(RangeError);
    expect(() => calcularScoreGutd(3, 3, 3, 6, PESOS_GUTD_PADRAO)).toThrow(RangeError);
  });
});

describe("classificarPrioridadeGutd", () => {
  it("faixas na escala 1-5", () => {
    expect(classificarPrioridadeGutd(5)).toBe("critica");
    expect(classificarPrioridadeGutd(4.5)).toBe("critica");
    expect(classificarPrioridadeGutd(4)).toBe("alta");
    expect(classificarPrioridadeGutd(3)).toBe("media");
    expect(classificarPrioridadeGutd(1)).toBe("baixa");
  });
});
