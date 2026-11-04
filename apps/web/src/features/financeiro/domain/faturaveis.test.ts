import { describe, expect, it } from "vitest";
import {
  calcularSaldoFaturavel,
  compararOrigemFaturavel,
  prepararConferenciaFaturavel,
} from "./faturaveis";

describe("prévia de conferência", () => {
  it("preserva valor original e exige motivo para ajuste", () => {
    expect(prepararConferenciaFaturavel(10000, 9500, "  ajuste contratual  ")).toEqual({
      valorOriginalCentavos: 10000,
      valorConferidoCentavos: 9500,
      motivo: "ajuste contratual",
    });
    expect(() => prepararConferenciaFaturavel(10000, 9500, "  ")).toThrow();
  });
  it("permite valor inalterado sem motivo, mas rejeita centavos inválidos", () => {
    expect(prepararConferenciaFaturavel(10000, 10000, "")).toEqual({
      valorOriginalCentavos: 10000,
      valorConferidoCentavos: 10000,
      motivo: null,
    });
    expect(() => prepararConferenciaFaturavel(10000, -1, "erro")).toThrow();
    expect(() => prepararConferenciaFaturavel(10000, 1.5, "erro")).toThrow();
  });
});

describe("prévia local de saldo faturável", () => {
  const itens = [
    { id: "parcela-1", valorCentavos: 6000 },
    { id: "parcela-2", valorCentavos: 4000 },
  ];
  it("calcula saldo por parcelas sem adicionar cobrança", () => {
    expect(calcularSaldoFaturavel(10000, [], [])).toBe(10000);
    expect(calcularSaldoFaturavel(10000, itens.slice(0, 1), [])).toBe(4000);
    expect(calcularSaldoFaturavel(10000, itens, [])).toBe(0);
  });
  it("vincula estorno à parcela original e considera apenas valor líquido", () => {
    expect(
      calcularSaldoFaturavel(10000, itens, [
        { id: "estorno", alocacaoId: "parcela-1", valorCentavos: 1000 },
      ]),
    ).toBe(1000);
    expect(
      calcularSaldoFaturavel(
        10000,
        [
          { id: "a", valorCentavos: 10000 },
          { id: "b", valorCentavos: 10000 },
        ],
        [{ id: "e", alocacaoId: "a", valorCentavos: 10000 }],
      ),
    ).toBe(0);
  });
  it("recusa duplicidade, estornos sem origem ou maiores que a parcela", () => {
    expect(() =>
      calcularSaldoFaturavel(
        10000,
        [itens[0], itens[0]].filter((item) => item !== undefined),
        [],
      ),
    ).toThrow();
    expect(() =>
      calcularSaldoFaturavel(10000, itens, [{ id: "e", alocacaoId: "outra", valorCentavos: 1 }]),
    ).toThrow();
    expect(() =>
      calcularSaldoFaturavel(10000, itens, [
        { id: "e", alocacaoId: "parcela-1", valorCentavos: 6001 },
      ]),
    ).toThrow();
    expect(() =>
      calcularSaldoFaturavel(10000, itens, [
        { id: "e", alocacaoId: "parcela-1", valorCentavos: 1 },
        { id: "e", alocacaoId: "parcela-1", valorCentavos: 1 },
      ]),
    ).toThrow();
  });
  it("recusa saldo negativo e valores inválidos, inclusive fora da precisão segura", () => {
    expect(() => calcularSaldoFaturavel(9999, itens, [])).toThrow();
    expect(() => calcularSaldoFaturavel(1.5, [], [])).toThrow();
    expect(() => calcularSaldoFaturavel(Number.MAX_SAFE_INTEGER + 1, [], [])).toThrow();
    expect(() => calcularSaldoFaturavel(10000, [{ id: "a", valorCentavos: 0 }], [])).toThrow();
  });
});

describe("comparação local de origem faturável", () => {
  const fato = {
    requestId: "pedido",
    clienteId: "cliente",
    origemTipo: "material_fornecido",
    origemId: "entrega",
    valorCentavos: 10000,
    competencia: "2026-10",
    evidencias: ["evidencia"],
  };
  it("identifica reentrega mesmo com novo requestId e recusa mudança de valor", () => {
    expect(compararOrigemFaturavel(fato, { ...fato, requestId: "outro" })).toBe(
      "reentrega_identica",
    );
    expect(compararOrigemFaturavel(fato, { ...fato, valorCentavos: 12000 })).toBe(
      "conteudo_divergente",
    );
    expect(compararOrigemFaturavel(fato, { ...fato, competencia: "2026-11" })).toBe(
      "conteudo_divergente",
    );
    expect(compararOrigemFaturavel(fato, { ...fato, evidencias: [] })).toBe("conteudo_divergente");
  });
  it("não mistura fatos de outro Cliente ou outra entrega", () => {
    expect(compararOrigemFaturavel(fato, { ...fato, clienteId: "outro" })).toBe("outra_origem");
    expect(compararOrigemFaturavel(fato, { ...fato, origemId: "outra_entrega" })).toBe(
      "outra_origem",
    );
  });
});
