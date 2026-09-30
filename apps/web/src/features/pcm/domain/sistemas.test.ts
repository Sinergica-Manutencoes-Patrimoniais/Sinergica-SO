import { describe, expect, it } from "vitest";
import {
  validarMembroMesmoCliente,
  validarMembroNaoDuplicado,
  validarMembroSemOutroSistema,
  validarSistema,
} from "./sistemas";

describe("sistemas", () => {
  it("E01-S156 AC-6: exige Categoria do catálogo", () => {
    expect(() => validarSistema({ clienteId: "c1", nome: "Sistema X" })).toThrow(
      "Categoria é obrigatória.",
    );
  });

  it("normaliza cadastro de sistema", () => {
    expect(
      validarSistema({
        clienteId: "c1",
        nome: "  Sistema de Hidrante Torre A  ",
        categoriaId: "cat-1",
        areaId: "",
      }),
    ).toEqual({
      clienteId: "c1",
      areaId: null,
      localId: null,
      nome: "Sistema de Hidrante Torre A",
      categoriaId: "cat-1",
      categoria: null,
      tipo: null,
      descricao: null,
    });
  });

  it("E01-S155: normaliza localId", () => {
    expect(
      validarSistema({
        clienteId: "c1",
        nome: "Sistema X",
        categoriaId: "cat-1",
        localId: "loc-1",
      }),
    ).toMatchObject({
      localId: "loc-1",
    });
  });

  it("bloqueia nome vazio", () => {
    expect(() => validarSistema({ clienteId: "c1", nome: "  " })).toThrow(
      "Nome do Sistema é obrigatório.",
    );
  });

  it("bloqueia sem cliente", () => {
    expect(() =>
      validarSistema({ clienteId: "", nome: "Sistema X", categoriaId: "cat-1" }),
    ).toThrow("Cliente é obrigatório.");
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

  it("E01-S154 AC-4: rejeita item que já pertence a outro Sistema", () => {
    expect(() =>
      validarMembroSemOutroSistema("sistema-b", {
        sistemaId: "sistema-a",
        sistemaNome: "Incêndio Torre B",
      }),
    ).toThrow("Componente já pertence ao Sistema «Incêndio Torre B». Remova de lá antes.");
  });

  it("E01-S154 AC-4: aceita item que já pertence ao MESMO Sistema (edição)", () => {
    expect(() =>
      validarMembroSemOutroSistema("sistema-a", {
        sistemaId: "sistema-a",
        sistemaNome: "Incêndio Torre B",
      }),
    ).not.toThrow();
  });

  it("E01-S154 AC-4: aceita item sem pertencimento nenhum", () => {
    expect(() => validarMembroSemOutroSistema("sistema-a", null)).not.toThrow();
  });
});
