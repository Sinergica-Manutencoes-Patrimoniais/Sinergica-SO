import { describe, expect, it } from "vitest";
import { validarFerramenta, validarFerramentaInline } from "./ferramentas";

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
      valorUnitario: null,
      custoUnitario: null,
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

  it("aceita e normaliza valor/custo unitário", () => {
    expect(
      validarFerramenta({
        nome: "Kit",
        quantidadeTotal: 2,
        quantidadeMinima: 0,
        valorUnitario: 129.9,
        custoUnitario: 80,
      }),
    ).toEqual({
      nome: "Kit",
      descricao: null,
      categoriaId: null,
      quantidadeTotal: 2,
      quantidadeMinima: 0,
      valorUnitario: 129.9,
      custoUnitario: 80,
    });
  });

  it("bloqueia valor unitário negativo", () => {
    expect(() =>
      validarFerramenta({
        nome: "Kit",
        quantidadeTotal: 1,
        quantidadeMinima: 0,
        valorUnitario: -5,
      }),
    ).toThrow("Valor unitário deve ser maior ou igual a zero.");
  });

  it("validação inline não lança, retorna mapa de erros por campo", () => {
    expect(validarFerramentaInline({ nome: "", quantidadeTotal: 1, quantidadeMinima: 2 })).toEqual({
      nome: "Nome é obrigatório.",
      quantidadeMinima: "Não pode exceder a quantidade total.",
    });
    expect(
      validarFerramentaInline({ nome: "Kit", quantidadeTotal: 2, quantidadeMinima: 1 }),
    ).toEqual({});
  });
});
