import { describe, expect, it } from "vitest";
import { validarContaBancaria } from "./conta-bancaria";

describe("validarContaBancaria", () => {
  it("exige nome", () => {
    expect(() =>
      validarContaBancaria({ nome: " ", saldoInicialCentavos: 0, saldoInicialEm: "2026-01-01" }),
    ).toThrow("Nome é obrigatório.");
  });

  it("exige data de corte", () => {
    expect(() =>
      validarContaBancaria({ nome: "Itaú PJ", saldoInicialCentavos: 0, saldoInicialEm: "" }),
    ).toThrow("Data de corte");
  });

  it("aceita conta válida e normaliza banco vazio para null", () => {
    const resultado = validarContaBancaria({
      nome: "Itaú PJ",
      banco: "  ",
      saldoInicialCentavos: 10000,
      saldoInicialEm: "2026-01-01",
    });
    expect(resultado).toEqual({
      nome: "Itaú PJ",
      banco: null,
      saldoInicialCentavos: 10000,
      saldoInicialEm: "2026-01-01",
    });
  });
});
