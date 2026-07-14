import { describe, expect, it } from "vitest";
import {
  type FerramentaUnidadeItem,
  calcularDivergenciaAuvo,
  validarAtribuicaoUnidade,
  validarBaixaUnidade,
  validarDevolucaoUnidade,
} from "./ferramenta-unidades";

function unidade(overrides: Partial<FerramentaUnidadeItem> = {}): FerramentaUnidadeItem {
  return {
    id: "u1",
    ferramentaId: "f1",
    ferramentaNome: "Furadeira",
    codigo: "FER-0001",
    status: "disponivel",
    atribuidaA: null,
    atribuidaANome: null,
    atribuidaEm: null,
    motivoBaixa: null,
    ...overrides,
  };
}

describe("ferramenta-unidades", () => {
  it("atribui unidade disponível", () => {
    expect(
      validarAtribuicaoUnidade({ unidadeId: "u1", funcionarioId: "func1" }, unidade()),
    ).toEqual({ unidadeId: "u1", funcionarioId: "func1" });
  });

  it("bloqueia atribuir unidade já atribuída", () => {
    expect(() =>
      validarAtribuicaoUnidade(
        { unidadeId: "u1", funcionarioId: "func1" },
        unidade({ status: "atribuida" }),
      ),
    ).toThrow("não está disponível");
  });

  it("bloqueia atribuir unidade baixada", () => {
    expect(() =>
      validarAtribuicaoUnidade(
        { unidadeId: "u1", funcionarioId: "func1" },
        unidade({ status: "baixada" }),
      ),
    ).toThrow("não está disponível");
  });

  it("bloqueia atribuição sem unidade encontrada", () => {
    expect(() =>
      validarAtribuicaoUnidade({ unidadeId: "u1", funcionarioId: "func1" }, undefined),
    ).toThrow("não encontrada");
  });

  it("devolve unidade atribuída, condição OK", () => {
    expect(
      validarDevolucaoUnidade(
        { unidadeId: "u1", condicao: "ok" },
        unidade({ status: "atribuida" }),
      ),
    ).toEqual({ unidadeId: "u1", condicao: "ok", motivo: null });
  });

  it("bloqueia devolver unidade que não está atribuída", () => {
    expect(() =>
      validarDevolucaoUnidade(
        { unidadeId: "u1", condicao: "ok" },
        unidade({ status: "disponivel" }),
      ),
    ).toThrow("não está atribuída");
  });

  it("exige motivo quando devolução vem danificada ou perdida", () => {
    expect(() =>
      validarDevolucaoUnidade(
        { unidadeId: "u1", condicao: "danificada" },
        unidade({ status: "atribuida" }),
      ),
    ).toThrow("Descreva o que aconteceu");
    expect(
      validarDevolucaoUnidade(
        { unidadeId: "u1", condicao: "perdida", motivo: "Caiu do telhado" },
        unidade({ status: "atribuida" }),
      ),
    ).toEqual({ unidadeId: "u1", condicao: "perdida", motivo: "Caiu do telhado" });
  });

  it("baixa unidade disponível ou atribuída, exige motivo", () => {
    expect(() => validarBaixaUnidade({ unidadeId: "u1", motivo: "" }, unidade())).toThrow(
      "Motivo da baixa",
    );
    expect(
      validarBaixaUnidade({ unidadeId: "u1", motivo: " Perdida em campo " }, unidade()),
    ).toEqual({ unidadeId: "u1", motivo: "Perdida em campo" });
  });

  it("bloqueia baixar unidade já baixada", () => {
    expect(() =>
      validarBaixaUnidade({ unidadeId: "u1", motivo: "x" }, unidade({ status: "baixada" })),
    ).toThrow("já está baixada");
  });

  it("calcula divergência Auvo vs PCM", () => {
    expect(calcularDivergenciaAuvo(3, 3)).toEqual({ divergente: false, diferenca: 0 });
    expect(calcularDivergenciaAuvo(3, 2)).toEqual({ divergente: true, diferenca: 1 });
    expect(calcularDivergenciaAuvo(1, 2)).toEqual({ divergente: true, diferenca: -1 });
  });
});
