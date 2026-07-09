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

  it("criação exige cargo, telefone e email — obrigatórios pelo Auvo (`/users`)", () => {
    const base = {
      nome: "Técnica",
      login: "tecnica",
      password: "senha123",
      culture: "pt-BR",
      userType: 1 as const,
    };
    expect(() => validarCriacaoFuncionario(base)).toThrow("Cargo é obrigatório");
    expect(() => validarCriacaoFuncionario({ ...base, cargo: "Campo" })).toThrow(
      "Telefone é obrigatório",
    );
    expect(() =>
      validarCriacaoFuncionario({ ...base, cargo: "Campo", telefone: "11999999999" }),
    ).toThrow("E-mail é obrigatório");
    expect(
      validarCriacaoFuncionario({
        ...base,
        cargo: "Campo",
        telefone: "11999999999",
        email: "tecnica@sinergica.com",
      }),
    ).toMatchObject({ cargo: "Campo", telefone: "11999999999", email: "tecnica@sinergica.com" });
  });
});
