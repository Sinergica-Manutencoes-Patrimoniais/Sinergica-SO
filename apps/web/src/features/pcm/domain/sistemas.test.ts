import { describe, expect, it } from "vitest";
import { validarMembroMesmoCliente, validarMembroNaoDuplicado, validarSistema } from "./sistemas";

describe("sistemas", () => {
  it("normaliza cadastro de sistema", () => {
    expect(
      validarSistema({ clienteId: "c1", nome: "  Sistema de Hidrante Torre A  ", areaId: "" }),
    ).toEqual({
      clienteId: "c1",
      areaId: null,
      nome: "Sistema de Hidrante Torre A",
      tipo: null,
      descricao: null,
    });
  });

  it("bloqueia nome vazio", () => {
    expect(() => validarSistema({ clienteId: "c1", nome: "  " })).toThrow(
      "Nome do Sistema é obrigatório.",
    );
  });

  it("bloqueia sem cliente", () => {
    expect(() => validarSistema({ clienteId: "", nome: "Sistema X" })).toThrow(
      "Cliente é obrigatório.",
    );
  });

  it("INV-5: rejeita item de cliente diferente", () => {
    expect(() => validarMembroMesmoCliente("c1", "c2")).toThrow(
      "Item deve pertencer ao mesmo cliente do Sistema.",
    );
  });

  it("INV-5: aceita item do mesmo cliente", () => {
    expect(() => validarMembroMesmoCliente("c1", "c1")).not.toThrow();
  });

  it("INV-6: rejeita item já membro", () => {
    expect(() => validarMembroNaoDuplicado([{ itemId: "i1" }, { itemId: "i2" }], "i1")).toThrow(
      "Este item já faz parte do Sistema.",
    );
  });

  it("INV-6: aceita item novo", () => {
    expect(() => validarMembroNaoDuplicado([{ itemId: "i1" }], "i2")).not.toThrow();
  });
});
