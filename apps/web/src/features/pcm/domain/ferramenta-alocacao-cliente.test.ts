import { describe, expect, it } from "vitest";
import { podeAlocar } from "./ferramenta-alocacao-cliente";
import type { AlocacaoFerramentaCliente } from "./ferramenta-alocacao-cliente";

const ATIVA: AlocacaoFerramentaCliente = {
  id: "a1",
  ferramentaId: "f1",
  ferramentaNome: "Furadeira",
  clienteId: "c1",
  clienteNome: "Cliente A",
  alocadaEm: "2026-07-01T00:00:00Z",
  devolvidaEm: null,
};

describe("podeAlocar", () => {
  it("permite quando não há alocação ativa", () => {
    expect(podeAlocar(null)).toBe(true);
  });

  it("bloqueia quando já existe alocação ativa", () => {
    expect(podeAlocar(ATIVA)).toBe(false);
  });
});
