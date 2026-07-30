import { describe, expect, it } from "vitest";
import { validarRoteiro } from "./roteiro-entrevista";

describe("validarRoteiro", () => {
  it("normaliza nome e perguntas", () => {
    expect(
      validarRoteiro({
        nome: "  Cadastro inicial  ",
        perguntas: [{ campo: " cnpj ", pergunta: " Qual o CNPJ? ", obrigatorio: true }],
      }),
    ).toEqual({
      nome: "Cadastro inicial",
      perguntas: [{ campo: "cnpj", pergunta: "Qual o CNPJ?", obrigatorio: true }],
    });
  });

  it("rejeita nome vazio", () => {
    expect(() =>
      validarRoteiro({ nome: "  ", perguntas: [{ campo: "x", pergunta: "y", obrigatorio: true }] }),
    ).toThrow(/Nome do roteiro/);
  });

  it("rejeita roteiro sem perguntas", () => {
    expect(() => validarRoteiro({ nome: "Cadastro", perguntas: [] })).toThrow(
      /pelo menos uma pergunta/,
    );
  });

  it("rejeita pergunta sem campo ou sem texto", () => {
    expect(() =>
      validarRoteiro({ nome: "x", perguntas: [{ campo: "", pergunta: "y", obrigatorio: true }] }),
    ).toThrow(/campo é obrigatório/);
    expect(() =>
      validarRoteiro({ nome: "x", perguntas: [{ campo: "y", pergunta: "", obrigatorio: true }] }),
    ).toThrow(/texto da pergunta/);
  });
});
