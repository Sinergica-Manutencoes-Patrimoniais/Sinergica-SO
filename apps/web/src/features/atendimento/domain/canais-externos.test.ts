import { describe, expect, it } from "vitest";
import { validarCanalExterno, validarWaTemplate } from "./canais-externos";

describe("validarCanalExterno", () => {
  it("rejeita nome vazio", () => {
    expect(() =>
      validarCanalExterno({
        tipo: "meta_wa",
        label: "  ",
        identificadorExterno: "",
        identificadorSecundario: "",
        verifyToken: "",
      }),
    ).toThrow("Nome do canal é obrigatório.");
  });

  it("aceita e normaliza campos opcionais vazios para null", () => {
    expect(
      validarCanalExterno({
        tipo: "instagram",
        label: "Conta principal",
        identificadorExterno: "",
        identificadorSecundario: "",
        verifyToken: "",
      }),
    ).toEqual({
      tipo: "instagram",
      label: "Conta principal",
      identificadorExterno: null,
      identificadorSecundario: null,
      verifyToken: null,
    });
  });
});

describe("validarWaTemplate", () => {
  it("rejeita sem canal selecionado", () => {
    expect(() =>
      validarWaTemplate({
        canalId: "",
        nome: "x",
        idioma: "pt_BR",
        categoria: "utility",
        corpo: "y",
      }),
    ).toThrow("Selecione a conexão WhatsApp.");
  });

  it("rejeita corpo vazio", () => {
    expect(() =>
      validarWaTemplate({
        canalId: "c1",
        nome: "x",
        idioma: "pt_BR",
        categoria: "utility",
        corpo: "  ",
      }),
    ).toThrow("Corpo do template é obrigatório.");
  });

  it("idioma vazio vira pt_BR", () => {
    expect(
      validarWaTemplate({ canalId: "c1", nome: "x", idioma: "", categoria: "utility", corpo: "y" })
        .idioma,
    ).toBe("pt_BR");
  });
});
