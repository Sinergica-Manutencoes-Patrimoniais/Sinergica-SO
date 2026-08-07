import { describe, expect, it } from "vitest";
import { isPapel, mesmoUsuario } from "./role";

describe("isPapel", () => {
  it.each(["superadmin", "supervisor", "colaborador", "cliente-sindico"])(
    "aceita '%s' como papel válido",
    (papel) => {
      expect(isPapel(papel)).toBe(true);
    },
  );

  it("rejeita papel inválido", () => {
    expect(isPapel("gerente")).toBe(false);
  });

  it("rejeita null/undefined", () => {
    expect(isPapel(null)).toBe(false);
    expect(isPapel(undefined)).toBe(false);
  });

  it("rejeita valor não-string", () => {
    expect(isPapel(42)).toBe(false);
  });
});

describe("mesmoUsuario", () => {
  const usuario = { id: "1", email: "a@b.com", nome: "Ana", papel: "supervisor" as const };

  it("considera igual quando os 4 campos batem, mesmo em objetos diferentes", () => {
    expect(mesmoUsuario(usuario, { ...usuario })).toBe(true);
  });

  it("considera igual quando é a mesma referência", () => {
    expect(mesmoUsuario(usuario, usuario)).toBe(true);
  });

  it("considera igual quando ambos são null", () => {
    expect(mesmoUsuario(null, null)).toBe(true);
  });

  it("considera diferente quando só um lado é null", () => {
    expect(mesmoUsuario(usuario, null)).toBe(false);
    expect(mesmoUsuario(null, usuario)).toBe(false);
  });

  it("considera diferente quando papel muda (ex.: revogação de acesso)", () => {
    expect(mesmoUsuario(usuario, { ...usuario, papel: "colaborador" })).toBe(false);
  });

  it("considera diferente quando nome ou email mudam", () => {
    expect(mesmoUsuario(usuario, { ...usuario, nome: "Outra" })).toBe(false);
    expect(mesmoUsuario(usuario, { ...usuario, email: "outro@b.com" })).toBe(false);
  });
});
