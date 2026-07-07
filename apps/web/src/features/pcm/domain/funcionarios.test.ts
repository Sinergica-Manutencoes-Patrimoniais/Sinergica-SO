import { describe, expect, it } from "vitest";
import { validarCriacaoFuncionario, validarFuncionario } from "./funcionarios";

describe("funcionarios", () => {
  it("valida cadastro comum sem credenciais", () => {
    expect(
      validarFuncionario({
        nome: "  Técnica  ",
        equipe: "",
        cargo: " Campo ",
        culture: "",
        userType: 1,
      }),
    ).toEqual({
      nome: "Técnica",
      equipe: null,
      cargo: "Campo",
      telefone: null,
      email: null,
      culture: "pt-BR",
      userType: 1,
    });
  });

  it("criação exige senha com limite Auvo de 14 caracteres", () => {
    expect(() =>
      validarCriacaoFuncionario({
        nome: "Técnica",
        login: "tecnica",
        password: "123456789012345",
        culture: "pt-BR",
        userType: 1,
      }),
    ).toThrow("Senha deve ter até 14 caracteres.");
  });
});
