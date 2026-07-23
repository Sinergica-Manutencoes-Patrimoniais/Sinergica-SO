import { describe, expect, it } from "vitest";
import { validarTransferencia } from "./transferencia";

const base = { contaOrigemId: "c1", contaDestinoId: "c2", valorCentavos: 1000, data: "2026-07-01" };

describe("validarTransferencia", () => {
  it("exige conta de origem e destino", () => {
    expect(() => validarTransferencia({ ...base, contaOrigemId: "" })).toThrow(
      "Conta de origem e destino são obrigatórias.",
    );
  });

  it("rejeita origem igual a destino", () => {
    expect(() => validarTransferencia({ ...base, contaDestinoId: "c1" })).toThrow(
      "Conta de origem e destino não podem ser a mesma.",
    );
  });

  it("rejeita valor zero", () => {
    expect(() => validarTransferencia({ ...base, valorCentavos: 0 })).toThrow(
      "Valor deve ser maior que zero.",
    );
  });

  it("exige data", () => {
    expect(() => validarTransferencia({ ...base, data: "" })).toThrow("Data é obrigatória.");
  });

  it("aceita transferencia valida", () => {
    expect(validarTransferencia(base).contaOrigemId).toBe("c1");
  });
});
