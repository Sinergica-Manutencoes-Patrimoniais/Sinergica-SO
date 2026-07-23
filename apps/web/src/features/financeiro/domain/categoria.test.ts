import { describe, expect, it } from "vitest";
import { categoriasRaiz, subcategoriasDe, validarCategoria } from "./categoria";
import type { CategoriaItem } from "./categoria";

const raiz: CategoriaItem = {
  id: "raiz-1",
  nome: "Operação",
  tipo: "saida",
  parentId: null,
  ativo: true,
  seed: true,
};

const sub: CategoriaItem = {
  id: "sub-1",
  nome: "Combustível",
  tipo: "saida",
  parentId: "raiz-1",
  ativo: true,
  seed: true,
};

describe("validarCategoria", () => {
  it("exige nome", () => {
    expect(() => validarCategoria({ nome: "  ", tipo: "entrada" }, [])).toThrow(
      "Nome é obrigatório.",
    );
  });

  it("aceita categoria raiz sem parent", () => {
    const resultado = validarCategoria({ nome: "Nova", tipo: "entrada" }, []);
    expect(resultado.parentId).toBeNull();
  });

  it("aceita subcategoria de uma raiz", () => {
    const resultado = validarCategoria({ nome: "Peças", tipo: "saida", parentId: "raiz-1" }, [
      raiz,
    ]);
    expect(resultado.parentId).toBe("raiz-1");
  });

  it("rejeita 3º nível (parent já é subcategoria)", () => {
    expect(() =>
      validarCategoria({ nome: "Neto", tipo: "saida", parentId: "sub-1" }, [raiz, sub]),
    ).toThrow("máximo de 2 níveis");
  });

  it("rejeita parent inexistente", () => {
    expect(() =>
      validarCategoria({ nome: "X", tipo: "entrada", parentId: "fantasma" }, [raiz]),
    ).toThrow("Categoria pai não encontrada.");
  });

  it("rejeita tipo divergente do pai", () => {
    expect(() =>
      validarCategoria({ nome: "X", tipo: "entrada", parentId: "raiz-1" }, [raiz]),
    ).toThrow("herda o tipo");
  });
});

describe("categoriasRaiz / subcategoriasDe", () => {
  it("separa raízes e subcategorias", () => {
    expect(categoriasRaiz([raiz, sub])).toEqual([raiz]);
    expect(subcategoriasDe([raiz, sub], "raiz-1")).toEqual([sub]);
  });
});
