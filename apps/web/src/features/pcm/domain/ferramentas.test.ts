import { describe, expect, it } from "vitest";
import { validarAlocacao, validarFerramenta } from "./ferramentas";

describe("ferramentas", () => {
  it("normaliza cadastro de ferramenta", () => {
    expect(
      validarFerramenta({
        nome: "  Multímetro ",
        descricao: "  Bancada ",
        categoriaId: "",
        quantidadeTotal: 3,
        quantidadeMinima: 1,
      }),
    ).toEqual({
      nome: "Multímetro",
      descricao: "Bancada",
      categoriaId: null,
      quantidadeTotal: 3,
      quantidadeMinima: 1,
    });
  });

  it("bloqueia mínimo maior que total", () => {
    expect(() =>
      validarFerramenta({
        nome: "Kit",
        quantidadeTotal: 1,
        quantidadeMinima: 2,
      }),
    ).toThrow("Quantidade mínima não pode exceder");
  });

  it("bloqueia alocação sem sincronismo Auvo", () => {
    expect(() =>
      validarAlocacao(
        { ferramentaId: "f1", funcionarioId: "u1", quantidade: 1 },
        {
          id: "f1",
          nome: "Kit",
          descricao: null,
          categoriaId: null,
          categoriaNome: null,
          quantidadeTotal: 2,
          quantidadeMinima: 0,
          ativo: true,
          auvoId: null,
          auvoSyncStatus: null,
          auvoSyncError: null,
          auvoSyncedAt: null,
        },
        { id: "u1", nome: "Técnico", auvoUserId: 7 },
      ),
    ).toThrow("Sincronize a ferramenta");
  });
});
