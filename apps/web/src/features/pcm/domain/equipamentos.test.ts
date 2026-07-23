import { describe, expect, it } from "vitest";
import { validarEquipamento, validarParentItem } from "./equipamentos";

describe("validarEquipamento", () => {
  it("exige nome", () => {
    expect(() => validarEquipamento({ nome: " " })).toThrow("Nome é obrigatório.");
  });

  it("normaliza campos opcionais vazios para null e default tipo=equipamento", () => {
    expect(
      validarEquipamento({
        nome: "  Bomba 1  ",
        identificador: "",
        categoria: " Pressurização ",
      }),
    ).toEqual({
      nome: "Bomba 1",
      identificador: null,
      categoria: "Pressurização",
      clientId: null,
      localizacao: null,
      observacoes: null,
      localId: null,
      tipo: "equipamento",
      parentItemId: null,
    });
  });

  it("AC-4: aceita tipo componente e localId", () => {
    expect(
      validarEquipamento({ nome: "Lâmpada", tipo: "componente", localId: "loc-1" }),
    ).toMatchObject({ tipo: "componente", localId: "loc-1" });
  });

  it("rejeita tipo inválido", () => {
    // biome-ignore lint/suspicious/noExplicitAny: testando input externo inválido de propósito
    expect(() => validarEquipamento({ nome: "X", tipo: "invalido" as any })).toThrow(
      "Tipo deve ser 'equipamento' ou 'componente'.",
    );
  });
});

describe("validarParentItem — AC-5", () => {
  it("aceita pai do mesmo cliente", () => {
    expect(() => validarParentItem("c1", { clientId: "c1", tipo: "equipamento" })).not.toThrow();
  });

  it("rejeita pai de cliente diferente", () => {
    expect(() => validarParentItem("c1", { clientId: "c2", tipo: "equipamento" })).toThrow(
      "O Equipamento pai deve pertencer ao mesmo cliente.",
    );
  });

  it("sem pai não valida nada", () => {
    expect(() => validarParentItem("c1", null)).not.toThrow();
  });
});
