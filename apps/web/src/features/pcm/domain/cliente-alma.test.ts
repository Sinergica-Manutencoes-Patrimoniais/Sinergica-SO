import { describe, expect, it } from "vitest";
import { validarAlma } from "./cliente-alma";

describe("validarAlma", () => {
  it("normaliza (trim)", () => {
    expect(validarAlma("  prefere áudio  ")).toBe("prefere áudio");
  });

  it("aceita vazio (cliente sem alma cadastrada ainda)", () => {
    expect(validarAlma("   ")).toBe("");
  });

  it("rejeita texto muito longo", () => {
    expect(() => validarAlma("a".repeat(4001))).toThrow(/4000/);
  });
});
