import { describe, expect, it } from "vitest";
import { normalizarJornada, validarCriacaoFuncionario, validarFuncionario } from "./funcionarios";

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
      jornadaDiariaHoras: null,
    });
  });

  it("normaliza jornada: número > 0 e ≤ 24 vale; resto vira null (E01-S77)", () => {
    expect(normalizarJornada(8)).toBe(8);
    expect(normalizarJornada(8.8)).toBe(8.8);
    expect(normalizarJornada(0)).toBeNull();
    expect(normalizarJornada(-2)).toBeNull();
    expect(normalizarJornada(30)).toBeNull();
    expect(normalizarJornada(null)).toBeNull();
    expect(normalizarJornada(undefined)).toBeNull();
    expect(normalizarJornada(Number.NaN)).toBeNull();
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
