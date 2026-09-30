import { describe, expect, it } from "vitest";
import { validarEquipamento, validarParentItem } from "./equipamentos";

describe("validarEquipamento", () => {
  it("exige nome", () => {
    expect(() => validarEquipamento({ nome: " ", clientId: "c1" })).toThrow("Nome é obrigatório.");
  });

  it("E01-S155 AC-5: exige cliente", () => {
    expect(() => validarEquipamento({ nome: "Bomba 1" })).toThrow("Cliente é obrigatório.");
    expect(() => validarEquipamento({ nome: "Bomba 1", clientId: "  " })).toThrow(
      "Cliente é obrigatório.",
    );
  });

  it("normaliza campos opcionais vazios para null e default tipo=equipamento", () => {
    expect(
      validarEquipamento({
        nome: "  Bomba 1  ",
        clientId: "c1",
        identificador: "",
        categoria: " Pressurização ",
      }),
    ).toEqual({
      nome: "Bomba 1",
      identificador: null,
      categoria: "Pressurização",
      clientId: "c1",
      localizacao: null,
      observacoes: null,
      localId: null,
      tipo: "equipamento",
      parentItemId: null,
      areaId: null,
    });
  });

  it("AC-4: aceita tipo componente e localId", () => {
    expect(
      validarEquipamento({ nome: "Lâmpada", clientId: "c1", tipo: "componente", localId: "loc-1" }),
    ).toMatchObject({ tipo: "componente", localId: "loc-1" });
  });

  it("E01-S155: aceita areaId", () => {
    expect(validarEquipamento({ nome: "Portão", clientId: "c1", areaId: "area-1" })).toMatchObject({
      areaId: "area-1",
    });
  });

  it("rejeita tipo inválido", () => {
    const invalido = { nome: "X", clientId: "c1", tipo: "invalido" } as unknown as Parameters<
      typeof validarEquipamento
    >[0];
    expect(() => validarEquipamento(invalido)).toThrow(
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
      "O Componente pai deve pertencer ao mesmo cliente.",
    );
  });

  it("sem pai não valida nada", () => {
    expect(() => validarParentItem("c1", null)).not.toThrow();
  });
});
