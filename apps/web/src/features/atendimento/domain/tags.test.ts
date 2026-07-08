import { describe, expect, it } from "vitest";
import { validarTag } from "./tags";

describe("validarTag", () => {
  it("aceita nome válido e remove espaços nas pontas", () => {
    expect(validarTag({ nome: "  Urgente  " })).toEqual({ nome: "Urgente" });
  });

  it("rejeita nome vazio ou só espaços", () => {
    expect(() => validarTag({ nome: "" })).toThrow("Nome da tag é obrigatório.");
    expect(() => validarTag({ nome: "   " })).toThrow("Nome da tag é obrigatório.");
  });
});
