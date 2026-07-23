import { describe, expect, it } from "vitest";
import { montarContextoTarefaAuvo, montarProdutosPrevistosAuvo } from "./contexto-tarefa-auvo";

describe("contexto de tarefa Auvo", () => {
  it("gera contexto operacional sem campos vazios", () => {
    expect(
      montarContextoTarefaAuvo({
        numeroOs: "OS-0001",
        titulo: "Bomba",
        cliente: "Condomínio A",
        descricao: "Vazamento",
        historico: ["OS anterior concluída"],
      }),
    ).toContain("Histórico relevante");
  });
  it("descarta produto sem id, quantidade ou valor válidos", () => {
    expect(
      montarProdutosPrevistosAuvo([
        { produtoId: "p1", quantidade: 2, valor: 10 },
        { produtoId: "", quantidade: 1, valor: 0 },
        { produtoId: "p2", quantidade: 0, valor: 2 },
      ]),
    ).toEqual([{ productId: "p1", quantity: 2, value: 10, discountType: 0, discountValue: 0 }]);
  });
});
