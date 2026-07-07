import { describe, expect, it } from "vitest";
import { centavosParaReais, reaisParaCentavos, validarServico } from "./servicos";

describe("servicos", () => {
  it("valida e normaliza serviço com preço em centavos", () => {
    expect(
      validarServico({
        titulo: "  Instalação ",
        descricao: "",
        precoCentavos: 12990,
      }),
    ).toEqual({
      titulo: "Instalação",
      descricao: null,
      precoCentavos: 12990,
    });
  });

  it("bloqueia preço zero", () => {
    expect(() => validarServico({ titulo: "Visita", precoCentavos: 0 })).toThrow("Preço deve ser");
  });

  it("converte reais somente na borda de UI", () => {
    expect(reaisParaCentavos("1.234,56")).toBe(123456);
    expect(centavosParaReais(123456)).toBe("1234,56");
  });
});
