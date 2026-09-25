import { describe, expect, it } from "vitest";
import {
  type MensagemItem,
  formatarCustoIaMensagem,
  formatarTotalCustoIaConversa,
  totalCustoIaConversa,
  validarMensagemRica,
  validarTextoMensagem,
} from "./mensagens";

function mensagem(overrides: Partial<MensagemItem>): MensagemItem {
  return {
    id: "1",
    conversaId: "c1",
    direcao: "saida",
    remetenteTipo: "ze",
    remetenteId: null,
    conteudo: "oi",
    statusEntrega: "enviado",
    erroDetalhe: null,
    createdAt: "2026-08-15T12:00:00Z",
    tipoConteudo: "texto",
    midiaUrl: null,
    midiaNome: null,
    midiaMime: null,
    payload: {},
    origemEnvio: null,
    custoIa: null,
    ...overrides,
  };
}

describe("validarTextoMensagem", () => {
  it("aceita texto válido e remove espaços nas pontas", () => {
    expect(validarTextoMensagem("  oi, tudo bem?  ")).toBe("oi, tudo bem?");
  });

  it("rejeita texto vazio ou só espaços", () => {
    expect(() => validarTextoMensagem("")).toThrow("Mensagem não pode ser vazia.");
    expect(() => validarTextoMensagem("   ")).toThrow("Mensagem não pode ser vazia.");
  });

  it("rejeita texto acima de 4000 caracteres", () => {
    expect(() => validarTextoMensagem("a".repeat(4001))).toThrow("Mensagem muito longa.");
  });
});

describe("validarMensagemRica", () => {
  it("aceita template e interativa no WhatsApp", () => {
    expect(
      validarMensagemRica({ tipo: "template", templateNome: "boas_vindas" }, "whatsapp"),
    ).toBeTruthy();
    expect(
      validarMensagemRica({ tipo: "interativa", texto: "Escolha", botoes: ["Sim"] }, "whatsapp"),
    ).toBeTruthy();
  });

  it("bloqueia canal/tipo sem suporte", () => {
    expect(() => validarMensagemRica({ tipo: "template", templateNome: "x" }, "instagram")).toThrow(
      "apenas no WhatsApp",
    );
    expect(() => validarMensagemRica({ tipo: "midia" }, "whatsapp")).toThrow("arquivo");
  });
});

describe("formatarCustoIaMensagem", () => {
  it("mostra 4 casas decimais em USD", () => {
    expect(formatarCustoIaMensagem(0.0042)).toBe("$0.0042");
  });
});

describe("formatarTotalCustoIaConversa", () => {
  it("mostra 2 casas decimais em USD", () => {
    expect(formatarTotalCustoIaConversa(1.5)).toBe("$1.50");
  });
});

describe("totalCustoIaConversa", () => {
  it("soma zero quando nenhuma mensagem tem custo", () => {
    const mensagens = [mensagem({}), mensagem({ id: "2", remetenteTipo: "humano" })];
    expect(totalCustoIaConversa(mensagens)).toBe(0);
  });

  it("soma só as mensagens com custoIa preenchido", () => {
    const mensagens = [
      mensagem({ custoIa: { usdCost: 0.01, modelo: "m", tokensIn: 1, tokensOut: 2 } }),
      mensagem({ id: "2", remetenteTipo: "humano", origemEnvio: "formulario" }),
      mensagem({ id: "3", custoIa: { usdCost: 0.02, modelo: "m", tokensIn: 1, tokensOut: 2 } }),
    ];
    expect(totalCustoIaConversa(mensagens)).toBeCloseTo(0.03);
  });
});
