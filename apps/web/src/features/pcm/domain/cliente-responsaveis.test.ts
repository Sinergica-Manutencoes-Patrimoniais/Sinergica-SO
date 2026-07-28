import { describe, expect, it } from "vitest";
import { validarResponsavel } from "./cliente-responsaveis";

describe("validarResponsavel", () => {
  it("normaliza nome/papel/contato", () => {
    expect(
      validarResponsavel({
        clienteId: "cli-1",
        nome: "  João Silva  ",
        papel: "  Síndico  ",
        contato: "  (11) 99999-0000  ",
      }),
    ).toEqual({
      clienteId: "cli-1",
      nome: "João Silva",
      papel: "Síndico",
      contato: "(11) 99999-0000",
    });
  });

  it("papel/contato são opcionais", () => {
    expect(validarResponsavel({ clienteId: "cli-1", nome: "João" })).toEqual({
      clienteId: "cli-1",
      nome: "João",
      papel: null,
      contato: null,
    });
  });

  it("rejeita nome vazio", () => {
    expect(() => validarResponsavel({ clienteId: "cli-1", nome: "   " })).toThrow(/Nome/);
  });

  it("rejeita sem cliente", () => {
    expect(() => validarResponsavel({ clienteId: "", nome: "João" })).toThrow(/Cliente/);
  });
});
