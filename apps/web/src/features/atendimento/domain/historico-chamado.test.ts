import { describe, expect, it } from "vitest";
import { calcularJanela, validarMensagensParaSnapshot } from "./historico-chamado";

describe("historico-chamado", () => {
  describe("calcularJanela", () => {
    it("AC-1: recorta N dias atrás até agora", () => {
      const agora = new Date("2026-07-21T12:00:00Z");
      const { dataInicio, dataFim } = calcularJanela(7, agora);
      expect(dataFim).toBe("2026-07-21T12:00:00.000Z");
      expect(dataInicio).toBe("2026-07-14T12:00:00.000Z");
    });

    it("rejeita janela zero ou negativa", () => {
      expect(() => calcularJanela(0)).toThrow(/pelo menos 1 dia/);
      expect(() => calcularJanela(-3)).toThrow(/pelo menos 1 dia/);
    });

    it("rejeita janela não inteira", () => {
      expect(() => calcularJanela(2.5)).toThrow(/pelo menos 1 dia/);
    });
  });

  describe("validarMensagensParaSnapshot", () => {
    it("caso de borda: janela sem mensagens rejeita antes de criar o registro", () => {
      expect(() => validarMensagensParaSnapshot([])).toThrow(/Nenhuma mensagem/);
    });

    it("com mensagens, não lança", () => {
      expect(() => validarMensagensParaSnapshot([{ id: "1" }])).not.toThrow();
    });
  });
});
