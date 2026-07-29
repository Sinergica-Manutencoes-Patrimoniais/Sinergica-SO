import { describe, expect, it } from "vitest";
import { validarResponsavel } from "./cliente-responsaveis";

describe("validarResponsavel", () => {
  it("normaliza nome/papel/email/telefone/preferência", () => {
    expect(
      validarResponsavel({
        clienteId: "cli-1",
        nome: "  João Silva  ",
        papel: "  Síndico  ",
        email: "  joao@exemplo.com  ",
        telefone: "  (11) 99999-0000  ",
        preferenciaContato: "whatsapp",
      }),
    ).toEqual({
      clienteId: "cli-1",
      nome: "João Silva",
      papel: "Síndico",
      email: "joao@exemplo.com",
      telefone: "(11) 99999-0000",
      preferenciaContato: "whatsapp",
    });
  });

  it("papel/email/telefone/preferência são opcionais", () => {
    expect(validarResponsavel({ clienteId: "cli-1", nome: "João" })).toEqual({
      clienteId: "cli-1",
      nome: "João",
      papel: null,
      email: null,
      telefone: null,
      preferenciaContato: null,
    });
  });

  it("rejeita nome vazio", () => {
    expect(() => validarResponsavel({ clienteId: "cli-1", nome: "   " })).toThrow(/Nome/);
  });

  it("rejeita sem cliente", () => {
    expect(() => validarResponsavel({ clienteId: "", nome: "João" })).toThrow(/Cliente/);
  });

  it("rejeita e-mail sem @", () => {
    expect(() =>
      validarResponsavel({ clienteId: "cli-1", nome: "João", email: "invalido" }),
    ).toThrow(/E-mail/);
  });

  it("aceita as 4 preferências de contato válidas", () => {
    for (const preferencia of ["whatsapp", "ligacao", "email", "outro"] as const) {
      expect(
        validarResponsavel({ clienteId: "cli-1", nome: "João", preferenciaContato: preferencia }),
      ).toMatchObject({ preferenciaContato: preferencia });
    }
  });
});
