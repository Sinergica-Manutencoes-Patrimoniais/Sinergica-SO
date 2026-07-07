import { describe, expect, it } from "vitest";
import { validarClienteGrupo } from "./cliente-grupos";

describe("validarClienteGrupo", () => {
  it("exige nome", () => {
    expect(() => validarClienteGrupo({ nome: "", clienteIds: ["c1"] })).toThrow(
      "Nome é obrigatório.",
    );
  });

  it("exige ao menos um cliente sincronizado", () => {
    expect(() => validarClienteGrupo({ nome: "Grupo", clienteIds: [] })).toThrow(
      "Selecione ao menos um cliente sincronizado.",
    );
  });

  it("remove clientes duplicados", () => {
    expect(validarClienteGrupo({ nome: " Grupo A ", clienteIds: ["c1", "c1", "c2"] })).toEqual({
      nome: "Grupo A",
      clienteIds: ["c1", "c2"],
    });
  });
});
