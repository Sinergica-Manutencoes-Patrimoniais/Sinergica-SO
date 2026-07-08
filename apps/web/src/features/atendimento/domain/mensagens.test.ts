import { describe, expect, it } from "vitest";
import { validarTextoMensagem } from "./mensagens";

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
