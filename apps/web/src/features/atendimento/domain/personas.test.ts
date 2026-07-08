import { describe, expect, it } from "vitest";
import { validarConfigIa, validarPersona } from "./personas";

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

describe("validarConfigIa", () => {
  it("aceita modelo e janela completa", () => {
    expect(
      validarConfigIa({
        modeloLlm: "  openai/gpt-4o-mini  ",
        janelaInicio: "08:00",
        janelaFim: "18:00",
        janelaDias: [1, 2, 3, 4, 5],
      }),
    ).toEqual({
      modeloLlm: "openai/gpt-4o-mini",
      janelaInicio: "08:00",
      janelaFim: "18:00",
      janelaDias: [1, 2, 3, 4, 5],
    });
  });

  it("aceita sem janela (ambos em branco)", () => {
    const resultado = validarConfigIa({
      modeloLlm: "openrouter/auto",
      janelaInicio: "",
      janelaFim: "",
      janelaDias: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(resultado.janelaInicio).toBeNull();
    expect(resultado.janelaFim).toBeNull();
  });

  it("rejeita modelo vazio", () => {
    expect(() =>
      validarConfigIa({ modeloLlm: "  ", janelaInicio: "", janelaFim: "", janelaDias: [0] }),
    ).toThrow("Modelo LLM é obrigatório.");
  });

  it("rejeita janela pela metade (só início ou só fim)", () => {
    expect(() =>
      validarConfigIa({ modeloLlm: "x", janelaInicio: "08:00", janelaFim: "", janelaDias: [0] }),
    ).toThrow("Informe início e fim da janela juntos, ou deixe os dois em branco.");
  });

  it("rejeita sem nenhum dia da semana selecionado", () => {
    expect(() =>
      validarConfigIa({ modeloLlm: "x", janelaInicio: "", janelaFim: "", janelaDias: [] }),
    ).toThrow("Selecione ao menos um dia da semana.");
  });
});
