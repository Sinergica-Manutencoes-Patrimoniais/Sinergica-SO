import { describe, expect, it } from "vitest";
import { centavosParaEntradaReais, valorReaisParaCentavos } from "./valor-em-reais";

describe("valor em reais", () => {
  it.each([["150,00", 15000], ["1.234,50", 123450], ["0,01", 1], ["10,5", 1050], ["0", 0]])
  ("converte %s sem arredondamento", (entrada, esperado) => {
    expect(valorReaisParaCentavos(entrada)).toBe(esperado);
  });

  it.each(["", "abc", "1,234", "12.34", "-1,00", "1,", "1e3", "9".repeat(25)])
  ("recusa entrada inválida %s", (entrada) => {
    expect(valorReaisParaCentavos(entrada)).toBeNull();
  });

  it("respeita o limite inteiro de centavos", () => {
    expect(valorReaisParaCentavos("10,00", 1000)).toBe(1000);
    expect(valorReaisParaCentavos("10,01", 1000)).toBeNull();
    expect(valorReaisParaCentavos("1", Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  });

  it("apresenta sugestão exata como entrada em reais", () => {
    expect(centavosParaEntradaReais("15000")).toBe("150,00");
    expect(centavosParaEntradaReais("1")).toBe("0,01");
    expect(() => centavosParaEntradaReais("1.5")).toThrow();
  });
});
