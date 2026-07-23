import { describe, expect, it } from "vitest";
import { validarReabertura } from "./fechamento";

describe("validarReabertura", () => {
  it("exige motivo não vazio (AC-3: auditável)", () => {
    expect(() => validarReabertura("")).toThrow(
      "Informe o motivo da reabertura (AC-3: auditável).",
    );
    expect(() => validarReabertura("   ")).toThrow();
  });

  it("aceita e retorna o motivo trimado", () => {
    expect(validarReabertura("  lançamento retroativo do contador  ")).toBe(
      "lançamento retroativo do contador",
    );
  });
});
