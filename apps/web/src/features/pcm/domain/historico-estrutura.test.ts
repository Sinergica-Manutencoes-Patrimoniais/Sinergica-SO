import { describe, expect, it } from "vitest";
import { type CatalogosHistorico, descreverCampoHistorico } from "./historico-estrutura";

const catalogos: CatalogosHistorico = {
  locais: [{ id: "11111111-1111-4111-8111-111111111111", nome: "Cobertura" }],
  categorias: [{ id: "22222222-2222-4222-8222-222222222222", nome: "Climatização" }],
  sistemas: [{ id: "33333333-3333-4333-8333-333333333333", nome: "Ar condicionado" }],
};

describe("descreverCampoHistorico (DEF-27)", () => {
  it("resolve o identificador de Local pelo nome", () => {
    expect(
      descreverCampoHistorico("local_id", "11111111-1111-4111-8111-111111111111", catalogos),
    ).toBe("Cobertura");
  });

  it("resolve Categoria e Sistema pelo nome", () => {
    expect(
      descreverCampoHistorico("categoria_id", "22222222-2222-4222-8222-222222222222", catalogos),
    ).toBe("Climatização");
    expect(
      descreverCampoHistorico("sistema_id", "33333333-3333-4333-8333-333333333333", catalogos),
    ).toBe("Ar condicionado");
  });

  it("identificador fora do catálogo não vaza o UUID na tela", () => {
    const fora = "99999999-9999-4999-8999-999999999999";
    expect(descreverCampoHistorico("local_id", fora, catalogos)).toBe("Local indisponível");
    expect(descreverCampoHistorico("categoria_id", fora, catalogos)).toBe("Categoria indisponível");
    expect(descreverCampoHistorico("sistema_id", fora, catalogos)).toBe("Sistema indisponível");
  });

  it("sem catálogo carregado, ainda não mostra o identificador", () => {
    expect(descreverCampoHistorico("local_id", "11111111-1111-4111-8111-111111111111")).toBe(
      "Local indisponível",
    );
  });

  it("campo sem catálogo mantém a descrição genérica", () => {
    expect(descreverCampoHistorico("nome", "Split 12k")).toBe("Split 12k");
    expect(descreverCampoHistorico("quantidade", 4)).toBe("4");
    expect(descreverCampoHistorico("ativo", false)).toBe("Não");
  });

  it("valor ausente é descrito, nunca omitido", () => {
    expect(descreverCampoHistorico("local_id", null, catalogos)).toBe("Não informado");
    expect(descreverCampoHistorico("nome", undefined)).toBe("Não informado");
  });
});
