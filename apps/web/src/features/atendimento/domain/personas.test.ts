import { describe, expect, it } from "vitest";
import { validarPersona } from "./personas";

describe("validarPersona", () => {
  it("aceita dados válidos e normaliza base de conhecimento vazia para null", () => {
    expect(
      validarPersona({
        nome: "  Zé  ",
        tipo: "chamados",
        promptSistema: "  Você é o Zé  ",
        baseConhecimento: "   ",
      }),
    ).toEqual({
      nome: "Zé",
      tipo: "chamados",
      promptSistema: "Você é o Zé",
      baseConhecimento: null,
    });
  });

  it("rejeita nome vazio", () => {
    expect(() =>
      validarPersona({ nome: "", tipo: "chamados", promptSistema: "x", baseConhecimento: "" }),
    ).toThrow("Nome da persona é obrigatório.");
  });

  it("rejeita prompt de sistema vazio", () => {
    expect(() =>
      validarPersona({ nome: "Zé", tipo: "chamados", promptSistema: "   ", baseConhecimento: "" }),
    ).toThrow("Prompt de sistema é obrigatório.");
  });
});
