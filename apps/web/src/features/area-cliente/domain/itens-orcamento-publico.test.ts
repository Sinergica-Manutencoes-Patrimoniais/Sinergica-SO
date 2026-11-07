import { expect, it } from "vitest";
import { projetarItensOrcamentoPublico } from "./itens-orcamento-publico";

it("preserva apenas descrição e quantidade tipadas, sem carregar campos de custo", () => {
  expect(
    projetarItensOrcamentoPublico([
      { descricao: "Peça", quantidade: 2, custo_centavos: 999, segredo: { custo: 10 } },
      { descricao: { custo: 999 }, quantidade: "2" },
      null,
    ]),
  ).toEqual([{ descricao: "Peça", quantidade: 2 }, {}, {}]);
});

it("rejeita entrada não representada como lista", () => {
  expect(projetarItensOrcamentoPublico({ custo_centavos: 999 })).toEqual([]);
});
