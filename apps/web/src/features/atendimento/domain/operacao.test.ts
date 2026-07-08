import { describe, expect, it } from "vitest";
import { validarConfigOperacao, validarEspecialista, validarLicao } from "./operacao";

const BASE_FORM = {
  toolUseEnabled: false,
  ragEnabled: false,
  vendasEnabled: false,
  consultaPedidosEnabled: false,
  limiteDiarioMensagens: "",
  transferirAposNRespostas: "",
  palavrasTransferencia: [],
  orcamentoMensalUsd: "",
};

describe("validarConfigOperacao", () => {
  it("rejeita modo vendas sem ferramentas ligado (AC-1)", () => {
    expect(() => validarConfigOperacao({ ...BASE_FORM, vendasEnabled: true })).toThrow(
      "Modo vendas exige Ferramentas (tool use) ligado.",
    );
  });

  it("aceita modo vendas com ferramentas ligado", () => {
    const resultado = validarConfigOperacao({
      ...BASE_FORM,
      toolUseEnabled: true,
      vendasEnabled: true,
    });
    expect(resultado.vendasEnabled).toBe(true);
  });

  it("converte campos numéricos vazios para null", () => {
    const resultado = validarConfigOperacao(BASE_FORM);
    expect(resultado.limiteDiarioMensagens).toBeNull();
    expect(resultado.transferirAposNRespostas).toBeNull();
    expect(resultado.orcamentoMensalUsd).toBeNull();
  });

  it("rejeita número inválido", () => {
    expect(() => validarConfigOperacao({ ...BASE_FORM, limiteDiarioMensagens: "abc" })).toThrow(
      "Limite diário deve ser um número válido (≥ 0).",
    );
  });

  it("filtra palavras de transferência vazias", () => {
    const resultado = validarConfigOperacao({
      ...BASE_FORM,
      palavrasTransferencia: ["urgente", "  ", "cancelar"],
    });
    expect(resultado.palavrasTransferencia).toEqual(["urgente", "cancelar"]);
  });
});

describe("validarLicao", () => {
  it("rejeita campos vazios", () => {
    expect(() => validarLicao({ contexto: "", respostaErrada: "x", respostaCerta: "y" })).toThrow(
      "Contexto é obrigatório.",
    );
  });

  it("aceita e normaliza espaços", () => {
    expect(
      validarLicao({ contexto: " ctx ", respostaErrada: " errado ", respostaCerta: " certo " }),
    ).toEqual({ contexto: "ctx", respostaErrada: "errado", respostaCerta: "certo" });
  });
});

describe("validarEspecialista", () => {
  it("rejeita nome vazio", () => {
    expect(() => validarEspecialista({ nome: "", quandoChamar: "x" })).toThrow(
      "Nome do especialista é obrigatório.",
    );
  });

  it("aceita dados válidos", () => {
    expect(validarEspecialista({ nome: "Financeiro", quandoChamar: "dúvidas de boleto" })).toEqual({
      nome: "Financeiro",
      quandoChamar: "dúvidas de boleto",
    });
  });
});
