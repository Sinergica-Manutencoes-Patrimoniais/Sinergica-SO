import { describe, expect, it } from "vitest";
import {
  amostraPequena,
  proporcaoPertoDoPiso,
  rotuloFonteTicket,
  taxaConversao,
} from "./metricas-comercial";

describe("taxaConversao", () => {
  it("entraram=0 é null, nunca NaN ou 0", () => {
    expect(taxaConversao(0, 0)).toBeNull();
  });

  it("calcula a proporção normal", () => {
    expect(taxaConversao(10, 4)).toBe(0.4);
  });

  it("avancaram maior que entraram ainda calcula (dado de outro período pode ultrapassar)", () => {
    expect(taxaConversao(2, 3)).toBe(1.5);
  });
});

describe("amostraPequena", () => {
  it("menos de 3 é pequena", () => {
    expect(amostraPequena(0)).toBe(true);
    expect(amostraPequena(1)).toBe(true);
    expect(amostraPequena(2)).toBe(true);
  });

  it("3 ou mais não é pequena", () => {
    expect(amostraPequena(3)).toBe(false);
    expect(amostraPequena(10)).toBe(false);
  });
});

describe("rotuloFonteTicket", () => {
  it("rotula as 3 fontes", () => {
    expect(rotuloFonteTicket("contrato")).toContain("contrato");
    expect(rotuloFonteTicket("proposta")).toContain("proposta");
    expect(rotuloFonteTicket("estimado")).toContain("estimado");
  });
});

describe("proporcaoPertoDoPiso", () => {
  it("quantidade=0 é null", () => {
    expect(proporcaoPertoDoPiso(0, 0)).toBeNull();
  });

  it("calcula a proporção", () => {
    expect(proporcaoPertoDoPiso(10, 3)).toBe(0.3);
  });
});
