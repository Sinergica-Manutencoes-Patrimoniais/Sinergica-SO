import { describe, expect, it } from "vitest";
import {
  agruparInadimplenciaPorCliente,
  agruparPorFaixa,
  ehAlerta,
  percentualCarteiraEmAtraso,
} from "./aging";
import type { RecebivelAging } from "./aging";

function recebivel(overrides: Partial<RecebivelAging>): RecebivelAging {
  return {
    lancamentoId: "l1",
    clienteId: "cli-1",
    contratoId: null,
    valorCentavos: 1000,
    dataVencimento: "2026-07-01",
    descricao: null,
    faixa: "a_vencer",
    diasAtraso: 0,
    ...overrides,
  };
}

describe("ehAlerta", () => {
  it("a_vencer nao e alerta, resto e", () => {
    expect(ehAlerta("a_vencer")).toBe(false);
    expect(ehAlerta("d1_3")).toBe(true);
    expect(ehAlerta("d15_mais")).toBe(true);
  });
});

describe("agruparPorFaixa", () => {
  it("agrupa cada recebivel na sua faixa", () => {
    const grupos = agruparPorFaixa([
      recebivel({ lancamentoId: "1", faixa: "a_vencer" }),
      recebivel({ lancamentoId: "2", faixa: "d1_3" }),
      recebivel({ lancamentoId: "3", faixa: "d1_3" }),
    ]);
    expect(grupos.a_vencer).toHaveLength(1);
    expect(grupos.d1_3).toHaveLength(2);
    expect(grupos.d15_mais).toHaveLength(0);
  });
});

describe("agruparInadimplenciaPorCliente", () => {
  it("soma total e pega o maior atraso por cliente, ignora a_vencer", () => {
    const resultado = agruparInadimplenciaPorCliente([
      recebivel({
        lancamentoId: "1",
        clienteId: "a",
        faixa: "d1_3",
        diasAtraso: 2,
        valorCentavos: 100,
      }),
      recebivel({
        lancamentoId: "2",
        clienteId: "a",
        faixa: "d8_15",
        diasAtraso: 10,
        valorCentavos: 200,
      }),
      recebivel({
        lancamentoId: "3",
        clienteId: "a",
        faixa: "a_vencer",
        diasAtraso: 0,
        valorCentavos: 999,
      }),
      recebivel({
        lancamentoId: "4",
        clienteId: "b",
        faixa: "d15_mais",
        diasAtraso: 20,
        valorCentavos: 50,
      }),
    ]);
    const clienteA = resultado.find((r) => r.clienteId === "a");
    expect(clienteA?.totalAtrasoCentavos).toBe(300);
    expect(clienteA?.diasMaisAntigo).toBe(10);
    expect(clienteA?.quantidade).toBe(2);
    expect(resultado.map((r) => r.clienteId)).toContain("b");
  });

  it("ordena desc por total em atraso", () => {
    const resultado = agruparInadimplenciaPorCliente([
      recebivel({ lancamentoId: "1", clienteId: "pequeno", faixa: "d1_3", valorCentavos: 100 }),
      recebivel({ lancamentoId: "2", clienteId: "grande", faixa: "d1_3", valorCentavos: 900 }),
    ]);
    expect(resultado[0]?.clienteId).toBe("grande");
  });
});

describe("percentualCarteiraEmAtraso", () => {
  it("calcula percentual em valor", () => {
    const percentual = percentualCarteiraEmAtraso([
      recebivel({ lancamentoId: "1", faixa: "a_vencer", valorCentavos: 700 }),
      recebivel({ lancamentoId: "2", faixa: "d1_3", valorCentavos: 300 }),
    ]);
    expect(percentual).toBeCloseTo(30);
  });

  it("carteira vazia da zero", () => {
    expect(percentualCarteiraEmAtraso([])).toBe(0);
  });
});
