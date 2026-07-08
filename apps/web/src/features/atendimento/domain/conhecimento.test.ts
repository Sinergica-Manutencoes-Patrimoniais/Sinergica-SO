import { describe, expect, it } from "vitest";
import { validarConhecimentoEntrada } from "./conhecimento";

const BASE = {
  personaId: "p1",
  titulo: "Como abrir chamado",
  conteudo: "Explique X",
  categoria: "faq",
  tags: [],
  prioridade: 5,
};

describe("validarConhecimentoEntrada", () => {
  it("rejeita título vazio", () => {
    expect(() => validarConhecimentoEntrada({ ...BASE, titulo: "  " })).toThrow(
      "Título é obrigatório.",
    );
  });

  it("rejeita conteúdo vazio", () => {
    expect(() => validarConhecimentoEntrada({ ...BASE, conteudo: "  " })).toThrow(
      "Conteúdo é obrigatório.",
    );
  });

  it("rejeita prioridade fora de 1-10", () => {
    expect(() => validarConhecimentoEntrada({ ...BASE, prioridade: 11 })).toThrow(
      "Prioridade deve estar entre 1 e 10.",
    );
  });

  it("categoria vazia vira 'geral'", () => {
    expect(validarConhecimentoEntrada({ ...BASE, categoria: "  " }).categoria).toBe("geral");
  });

  it("personaId vazio vira null (entrada global)", () => {
    expect(validarConhecimentoEntrada({ ...BASE, personaId: "" }).personaId).toBeNull();
  });
});
