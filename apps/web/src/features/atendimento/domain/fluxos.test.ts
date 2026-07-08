import { describe, expect, it } from "vitest";
import { copiarRecipe, novoPasso, validarFluxo, validarPassos } from "./fluxos";
import type { PassoFluxo } from "./fluxos";

describe("validarFluxo", () => {
  it("aceita nome e personaId válidos", () => {
    expect(validarFluxo({ nome: "  Qualificação  ", personaId: "persona-1" })).toEqual({
      nome: "Qualificação",
      personaId: "persona-1",
    });
  });

  it("rejeita nome vazio", () => {
    expect(() => validarFluxo({ nome: "", personaId: "persona-1" })).toThrow(
      "Nome do fluxo é obrigatório.",
    );
  });

  it("rejeita personaId vazio", () => {
    expect(() => validarFluxo({ nome: "Qualificação", personaId: "" })).toThrow(
      "Persona é obrigatória.",
    );
  });
});

describe("novoPasso", () => {
  it("posiciona o primeiro passo em ordem 0", () => {
    const passo = novoPasso([]);
    expect(passo.ordem).toBe(0);
    expect(passo.y).toBe(0);
  });

  it("empilha o próximo passo abaixo do último", () => {
    const passo = novoPasso([novoPasso([])]);
    expect(passo.ordem).toBe(1);
    expect(passo.y).toBe(150);
  });
});

function fakePasso(overrides: Partial<PassoFluxo> = {}): PassoFluxo {
  return {
    id: "p1",
    campo: "orcamento",
    pergunta: "Qual o orçamento?",
    obrigatorio: true,
    ordem: 0,
    x: 100,
    y: 0,
    ...overrides,
  };
}

describe("validarPassos", () => {
  it("ordena por ordem e aceita passos válidos", () => {
    const passos = [fakePasso({ id: "p2", ordem: 1 }), fakePasso({ id: "p1", ordem: 0 })];
    expect(validarPassos(passos).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("rejeita passo sem campo", () => {
    expect(() => validarPassos([fakePasso({ campo: "  " })])).toThrow(
      "Todo passo precisa de um nome de campo.",
    );
  });

  it("rejeita passo sem pergunta", () => {
    expect(() => validarPassos([fakePasso({ pergunta: "  " })])).toThrow(
      "Todo passo precisa de uma pergunta.",
    );
  });
});

describe("grafo ramificável", () => {
  it("aceita ramificação alcançável e rejeita ciclo/nó órfão", () => {
    const raiz = fakePasso({ id: "raiz", proximoIds: ["a", "b"] });
    const a = fakePasso({ id: "a", ordem: 1, proximoIds: [] });
    const b = fakePasso({ id: "b", ordem: 2, proximoIds: [] });
    expect(validarPassos([raiz, a, b])).toHaveLength(3);
    expect(() => validarPassos([raiz, a, { ...b, proximoIds: ["raiz"] }])).toThrow("ciclos");
    expect(() => validarPassos([{ ...raiz, proximoIds: ["a"] }, a, b])).toThrow("órfão");
  });

  it("copia recipe sem manter ids/referência viva", () => {
    const original = fakePasso({ id: "origem", proximoIds: [] });
    const copia = copiarRecipe({ id: "r1", nome: "R", descricao: "", definicao: [original] });
    expect(copia[0]?.id).not.toBe(original.id);
    if (!copia[0]) throw new Error("cópia ausente");
    copia[0].campo = "alterado";
    expect(original.campo).toBe("orcamento");
  });
});
