import { describe, expect, it } from "vitest";
import { validarCancelamento, validarNovoChamado, validarTransicaoParaOs } from "./chamados";
import type { Chamado } from "./chamados";

describe("chamados", () => {
  describe("validarNovoChamado", () => {
    it("normaliza título/descrição/solicitante e aplica origem padrão 'manual'", () => {
      expect(
        validarNovoChamado({
          clienteId: "cli-1",
          titulo: "  Vazamento no térreo  ",
          descricao: "  ",
          solicitante: "  João  ",
        }),
      ).toEqual({
        clienteId: "cli-1",
        titulo: "Vazamento no térreo",
        descricao: null,
        origem: "manual",
        solicitante: "João",
        origemInspecaoItemId: null,
      });
    });

    it("rejeita sem cliente", () => {
      expect(() => validarNovoChamado({ clienteId: "", titulo: "x" })).toThrow(/Cliente/);
    });

    it("rejeita sem título", () => {
      expect(() => validarNovoChamado({ clienteId: "cli-1", titulo: "   " })).toThrow(/Título/);
    });

    it("preserva origem explícita (ex: whatsapp)", () => {
      expect(
        validarNovoChamado({ clienteId: "cli-1", titulo: "x", origem: "whatsapp" }).origem,
      ).toBe("whatsapp");
    });
  });

  describe("validarTransicaoParaOs", () => {
    it("permite quando o Chamado está aberto", () => {
      expect(() => validarTransicaoParaOs({ status: "aberto" })).not.toThrow();
    });

    it("AC-3: rejeita quando já convertido/backlog/cancelado", () => {
      expect(() => validarTransicaoParaOs({ status: "convertido_os" })).toThrow();
      expect(() => validarTransicaoParaOs({ status: "backlog" })).toThrow();
      expect(() => validarTransicaoParaOs({ status: "cancelado" })).toThrow();
    });
  });

  describe("validarCancelamento", () => {
    it("AC-4: exige justificativa não vazia", () => {
      expect(() => validarCancelamento({ status: "aberto" }, "  ")).toThrow(/Justificativa/);
      expect(validarCancelamento({ status: "aberto" }, "  Cliente desistiu  ")).toBe(
        "Cliente desistiu",
      );
    });

    it("bloqueia cancelar um Chamado já convertido em OS", () => {
      expect(() => validarCancelamento({ status: "convertido_os" }, "motivo")).toThrow(
        /já virou OS/,
      );
    });

    it("bloqueia cancelar duas vezes", () => {
      expect(() => validarCancelamento({ status: "cancelado" }, "motivo")).toThrow(
        /já está cancelado/,
      );
    });

    it("permite cancelar backlog", () => {
      const status: Chamado["status"] = "backlog";
      expect(validarCancelamento({ status }, "não é mais necessário")).toBe(
        "não é mais necessário",
      );
    });
  });
});
