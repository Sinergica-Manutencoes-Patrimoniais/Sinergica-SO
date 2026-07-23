import { describe, expect, it } from "vitest";
import { diffComposicaoSistema, filtrarItensPorNome } from "./composicao-sistema";

describe("composicao-sistema", () => {
  describe("filtrarItensPorNome", () => {
    const itens = [
      { id: "1", nome: "Bomba de recalque" },
      { id: "2", nome: "Quadro elétrico" },
      { id: "3", nome: "Bomba de incêndio" },
    ];

    it("sem termo devolve a lista inteira", () => {
      expect(filtrarItensPorNome(itens, "")).toEqual(itens);
      expect(filtrarItensPorNome(itens, "   ")).toEqual(itens);
    });

    it("filtra por substring, case-insensitive", () => {
      expect(filtrarItensPorNome(itens, "bomba").map((i) => i.id)).toEqual(["1", "3"]);
      expect(filtrarItensPorNome(itens, "BOMBA").map((i) => i.id)).toEqual(["1", "3"]);
      expect(filtrarItensPorNome(itens, "quadro").map((i) => i.id)).toEqual(["2"]);
    });

    it("sem match nenhum devolve lista vazia", () => {
      expect(filtrarItensPorNome(itens, "gerador")).toEqual([]);
    });
  });

  describe("diffComposicaoSistema", () => {
    it("marcar um item novo entra em 'adicionar'", () => {
      expect(diffComposicaoSistema(["a"], ["a", "b"])).toEqual({
        adicionar: ["b"],
        remover: [],
      });
    });

    it("desmarcar um item existente entra em 'remover'", () => {
      expect(diffComposicaoSistema(["a", "b"], ["a"])).toEqual({
        adicionar: [],
        remover: ["b"],
      });
    });

    it("combina adição e remoção no mesmo diff", () => {
      expect(diffComposicaoSistema(["a", "b"], ["b", "c"])).toEqual({
        adicionar: ["c"],
        remover: ["a"],
      });
    });

    it("sem mudança nenhuma — diff vazio", () => {
      expect(diffComposicaoSistema(["a", "b"], ["a", "b"])).toEqual({
        adicionar: [],
        remover: [],
      });
    });
  });
});
