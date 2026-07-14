import { describe, expect, it } from "vitest";
import { validarFerramenta } from "./ferramentas";

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
});
