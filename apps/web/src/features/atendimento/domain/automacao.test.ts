import { describe, expect, it } from "vitest";
import { validarIgAutomation } from "./automacao";

const BASE = {
  canalId: "c1",
  nome: "Promo",
  palavrasGatilho: ["preço"],
  respostaDm: "Chama no Direct!",
};

describe("validarIgAutomation", () => {
  it("rejeita nome vazio", () => {
    expect(() => validarIgAutomation({ ...BASE, nome: "  " })).toThrow(
      "Nome da regra é obrigatório.",
    );
  });

  it("rejeita sem palavra-gatilho", () => {
    expect(() => validarIgAutomation({ ...BASE, palavrasGatilho: [] })).toThrow(
      "Informe ao menos uma palavra-gatilho.",
    );
  });

  it("rejeita resposta de DM vazia", () => {
    expect(() => validarIgAutomation({ ...BASE, respostaDm: "  " })).toThrow(
      "Mensagem do Direct é obrigatória.",
    );
  });

  it("aceita dados válidos", () => {
    const resultado = validarIgAutomation(BASE);
    expect(resultado.nome).toBe("Promo");
    expect(resultado.palavrasGatilho).toEqual(["preço"]);
  });
});
