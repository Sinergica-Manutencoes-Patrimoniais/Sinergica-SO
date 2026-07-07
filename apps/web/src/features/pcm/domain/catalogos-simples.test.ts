import { describe, expect, it } from "vitest";
import {
  campoCatalogoSimples,
  labelCatalogoSimples,
  validarCatalogoSimples,
} from "./catalogos-simples";

describe("catalogos-simples", () => {
  it("normaliza descrição", () => {
    expect(validarCatalogoSimples({ descricao: "  Condomínio  " })).toEqual({
      descricao: "Condomínio",
    });
  });

  it("rejeita descrição vazia", () => {
    expect(() => validarCatalogoSimples({ descricao: " " })).toThrow("Descrição é obrigatória.");
  });

  it("rotula os dois catálogos", () => {
    expect(labelCatalogoSimples("segmentos")).toBe("Segmentos");
    expect(labelCatalogoSimples("palavras_chave")).toBe("Palavras-chave");
    expect(labelCatalogoSimples("produto_categorias")).toBe("Categorias de Produto");
    expect(labelCatalogoSimples("equipamento_categorias")).toBe("Categorias de Equipamento");
  });

  it("usa rótulo de campo adequado por catálogo", () => {
    expect(campoCatalogoSimples("segmentos")).toBe("Descrição");
    expect(campoCatalogoSimples("produto_categorias")).toBe("Nome");
  });
});
