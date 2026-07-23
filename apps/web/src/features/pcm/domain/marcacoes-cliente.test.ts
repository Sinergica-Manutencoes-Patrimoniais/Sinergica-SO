import { describe, expect, it } from "vitest";
import { validarMarcacao } from "./marcacoes-cliente";

describe("marcacoes-cliente", () => {
  describe("validarMarcacao", () => {
    it("AC-1: aceita nome+cor válidos, normaliza espaços do nome", () => {
      expect(validarMarcacao({ nome: "  Ativo com contrato  ", cor: "#16A34A" })).toEqual({
        nome: "Ativo com contrato",
        cor: "#16A34A",
      });
    });

    it("rejeita nome vazio", () => {
      expect(() => validarMarcacao({ nome: "  ", cor: "#16A34A" })).toThrow(/Nome/);
    });

    it("rejeita cor fora do formato hex", () => {
      expect(() => validarMarcacao({ nome: "Lead", cor: "verde" })).toThrow(/hex/);
      expect(() => validarMarcacao({ nome: "Lead", cor: "#FFF" })).toThrow(/hex/);
    });
  });
});
