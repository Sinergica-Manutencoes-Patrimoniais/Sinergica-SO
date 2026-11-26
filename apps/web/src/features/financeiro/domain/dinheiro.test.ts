import { describe, expect, it } from "vitest";
import { centavosParaReais, centavosParaReaisComSinal, reaisParaCentavos } from "./dinheiro";

describe("reaisParaCentavos", () => {
  it("converte formato BR com milhar e centavos", () => {
    expect(reaisParaCentavos("1.234,56")).toBe(123456);
  });

  it("converte valor pequeno", () => {
    expect(reaisParaCentavos("0,01")).toBe(1);
  });

  it("vazio vira zero", () => {
    expect(reaisParaCentavos("")).toBe(0);
  });

  it("texto inválido vira zero", () => {
    expect(reaisParaCentavos("abc")).toBe(0);
  });
});

describe("centavosParaReais", () => {
  it("formata centavos em string BR", () => {
    expect(centavosParaReais(123456)).toBe("1234,56");
  });

  it("formata zero", () => {
    expect(centavosParaReais(0)).toBe("0,00");
  });
});

describe("centavosParaReaisComSinal", () => {
  it("mantém o sinal de menos em resultado negativo", () => {
    expect(centavosParaReaisComSinal(-137)).toBe("-1,37");
  });

  it("não prefixa sinal em resultado positivo", () => {
    expect(centavosParaReaisComSinal(137)).toBe("1,37");
  });

  it("zero não recebe sinal", () => {
    expect(centavosParaReaisComSinal(0)).toBe("0,00");
  });

  it("negativo com milhar mantém formato BR", () => {
    expect(centavosParaReaisComSinal(-123456)).toBe("-1234,56");
  });
});
