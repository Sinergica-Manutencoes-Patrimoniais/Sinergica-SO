import { describe, expect, it } from "vitest";
import { validarClienteForm } from "./clientes-crud";

describe("validarClienteForm", () => {
  it("exige nome", () => {
    expect(() => validarClienteForm({ nome: "  " })).toThrow("Nome é obrigatório.");
  });

  it("normaliza campos opcionais vazios para null", () => {
    expect(
      validarClienteForm({
        nome: "  Condomínio Primavera  ",
        cnpj: "",
        estado: "sp",
        contatoEmail: " sindico@example.com ",
      }),
    ).toEqual({
      nome: "Condomínio Primavera",
      cnpj: null,
      endereco: null,
      cidade: null,
      estado: "SP",
      cep: null,
      contatoNome: null,
      contatoTelefone: null,
      contatoEmail: "sindico@example.com",
      observacoes: null,
    });
  });

  it("E01-S148: preserva ativo/tipo/statusComercial quando informados (edição)", () => {
    const resultado = validarClienteForm({
      nome: "Condomínio Primavera",
      ativo: false,
      tipo: "cliente",
      statusComercial: "inativo",
    });
    expect(resultado.ativo).toBe(false);
    expect(resultado.statusComercial).toBe("inativo");
  });
});
