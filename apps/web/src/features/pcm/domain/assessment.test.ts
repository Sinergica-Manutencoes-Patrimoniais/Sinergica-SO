import { describe, expect, it } from "vitest";
import {
  mapearQuestionarioParaQuestoes,
  validarDerivarItem,
  validarNovoAssessment,
} from "./assessment";

describe("assessment (domínio)", () => {
  describe("validarNovoAssessment", () => {
    it("AC-1: exige cliente e data", () => {
      expect(() =>
        validarNovoAssessment({ clientId: "", motivo: "inicio", dataInspecao: "2026-07-21" }),
      ).toThrow(/Cliente/);
      expect(() =>
        validarNovoAssessment({ clientId: "cli-1", motivo: "inicio", dataInspecao: "" }),
      ).toThrow(/Data/);
    });

    it("aceita input válido", () => {
      const input = { clientId: "cli-1", motivo: "anual" as const, dataInspecao: "2026-07-21" };
      expect(validarNovoAssessment(input)).toEqual(input);
    });
  });

  describe("validarDerivarItem", () => {
    it("caso de borda: item já derivado não deriva de novo", () => {
      expect(() => validarDerivarItem({ destino: "chamado" })).toThrow(/já foi derivado/);
    });

    it("item sem destino pode derivar", () => {
      expect(() => validarDerivarItem({ destino: null })).not.toThrow();
    });
  });

  describe("mapearQuestionarioParaQuestoes", () => {
    it("D2: mapeia formato reconhecido (pergunta/resposta/fotos)", () => {
      const questoes = mapearQuestionarioParaQuestoes([
        { id: "q1", pergunta: "Hidrante funcional?", resposta: "Não", fotos: ["a.jpg", "b.jpg"] },
      ]);
      expect(questoes).toEqual([
        {
          chave: "q1",
          pergunta: "Hidrante funcional?",
          resposta: "Não",
          fotoUrls: ["a.jpg", "b.jpg"],
        },
      ]);
    });

    it("D2: mapeia formato alternativo (question/answer/photos)", () => {
      const questoes = mapearQuestionarioParaQuestoes([
        { question: "Elevador ok?", answer: "Sim", photos: [{ url: "c.jpg" }] },
      ]);
      expect(questoes[0]).toMatchObject({
        pergunta: "Elevador ok?",
        resposta: "Sim",
        fotoUrls: ["c.jpg"],
      });
    });

    it("caso de borda: resposta não mapeada vira item 'a classificar', nunca some", () => {
      const questoes = mapearQuestionarioParaQuestoes([{ campoDesconhecido: 42 }]);
      expect(questoes).toHaveLength(1);
      expect(questoes[0]?.pergunta).toBe("Item a classificar");
      expect(questoes[0]?.resposta).toContain("42");
    });

    it("checklist ausente/vazio não quebra", () => {
      expect(mapearQuestionarioParaQuestoes(null)).toEqual([]);
      expect(mapearQuestionarioParaQuestoes([])).toEqual([]);
    });
  });
});
