import { describe, expect, it } from "vitest";
import { validarEquipamento } from "./equipamentos";

describe("validarEquipamento", () => {
  it("exige nome", () => {
    expect(() => validarEquipamento({ nome: " " })).toThrow("Nome é obrigatório.");
  });

  it("normaliza campos opcionais vazios para null", () => {
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
    });
  });
});
