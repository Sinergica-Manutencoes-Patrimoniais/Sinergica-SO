import { describe, expect, it } from "vitest";
import { validarClusterRegra, validarLeadScoringConfig } from "./scoring-clusters";

describe("validarLeadScoringConfig", () => {
  it("aceita números válidos", () => {
    expect(
      validarLeadScoringConfig({
        windowDays: "14",
        behaviorCap: "50",
        rescoreCooldownSeconds: "90",
        scoreReachedThreshold: "60",
      }),
    ).toEqual({
      windowDays: 14,
      behaviorCap: 50,
      rescoreCooldownSeconds: 90,
      scoreReachedThreshold: 60,
    });
  });

  it("rejeita não-inteiro", () => {
    expect(() =>
      validarLeadScoringConfig({
        windowDays: "14.5",
        behaviorCap: "50",
        rescoreCooldownSeconds: "90",
        scoreReachedThreshold: "60",
      }),
    ).toThrow("Janela (dias) deve ser um número inteiro (≥ 0).");
  });

  it("rejeita negativo", () => {
    expect(() =>
      validarLeadScoringConfig({
        windowDays: "-1",
        behaviorCap: "50",
        rescoreCooldownSeconds: "90",
        scoreReachedThreshold: "60",
      }),
    ).toThrow("Janela (dias) deve ser um número inteiro (≥ 0).");
  });
});

describe("validarClusterRegra", () => {
  it("rejeita nome vazio", () => {
    expect(() =>
      validarClusterRegra({ nome: " ", leadTier: "", segmento: "", subsegmento: "" }),
    ).toThrow("Nome do cluster é obrigatório.");
  });

  it("aceita campos opcionais vazios como null", () => {
    expect(
      validarClusterRegra({ nome: "VIP", leadTier: "", segmento: "", subsegmento: "" }),
    ).toEqual({
      nome: "VIP",
      leadTier: null,
      segmento: null,
      subsegmento: null,
    });
  });

  it("aceita lead tier definido", () => {
    expect(
      validarClusterRegra({ nome: "VIP", leadTier: "A", segmento: "condomínios", subsegmento: "" })
        .leadTier,
    ).toBe("A");
  });
});
