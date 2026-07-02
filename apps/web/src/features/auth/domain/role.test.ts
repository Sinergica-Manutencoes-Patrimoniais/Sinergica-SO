import { describe, expect, it } from "vitest";
import { isPapel } from "./role";

describe("isPapel", () => {
  it.each(["admin", "escritorio", "tecnico", "cliente-sindico"])(
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
