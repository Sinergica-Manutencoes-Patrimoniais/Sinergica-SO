import { describe, expect, it } from "vitest";
import { validarCanalExterno, validarConexaoMeta, validarWaTemplate } from "./canais-externos";

describe("validarCanalExterno", () => {
  it("rejeita nome vazio", () => {
    expect(() =>
      validarCanalExterno({
        tipo: "meta_wa",
        label: "  ",
        identificadorExterno: "",
        identificadorSecundario: "",
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
      }),
    ).toEqual({
      tipo: "instagram",
      label: "Conta principal",
      identificadorExterno: null,
      identificadorSecundario: null,
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

describe("validarConexaoMeta", () => {
  const base = {
    canalId: "c1",
    contaExternaId: "17841400000000000",
    accessToken: "a".repeat(40),
    appSecret: "b".repeat(32),
    verifyToken: "c".repeat(16),
  };

  it("aceita uma conexão completa e normaliza espaços", () => {
    expect(validarConexaoMeta({ ...base, contaExternaId: " 17841400000000000 " })).toEqual(base);
  });

  it("recusa ID de conta que não é numérico", () => {
    expect(() => validarConexaoMeta({ ...base, contaExternaId: "@sinergica" })).toThrow(/só número/);
  });

  it("recusa token, app secret e verify token curtos demais", () => {
    expect(() => validarConexaoMeta({ ...base, accessToken: "curto" })).toThrow(/token de acesso/);
    expect(() => validarConexaoMeta({ ...base, appSecret: "x" })).toThrow(/app secret/);
    expect(() => validarConexaoMeta({ ...base, verifyToken: "curto" })).toThrow(/verificação/);
  });

  it("recusa sem canal selecionado", () => {
    expect(() => validarConexaoMeta({ ...base, canalId: "" })).toThrow(/Selecione a conexão/);
  });
});
