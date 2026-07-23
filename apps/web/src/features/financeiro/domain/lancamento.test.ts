import { describe, expect, it } from "vitest";
import {
  baixarLancamento,
  estaConciliado,
  estornarBaixa,
  podeExcluirOuAlterarValor,
  validarLancamento,
} from "./lancamento";

const base = {
  tipo: "entrada" as const,
  valorCentavos: 10000,
  dataCompetencia: "2026-07-01",
  categoriaId: "cat-1",
};

describe("validarLancamento", () => {
  it("rejeita valor zero ou negativo", () => {
    expect(() =>
      validarLancamento({
        ...base,
        status: "realizado",
        dataPagamento: "2026-07-05",
        valorCentavos: 0,
      }),
    ).toThrow("Valor deve ser maior que zero.");
  });

  it("previsto exige vencimento", () => {
    expect(() => validarLancamento({ ...base, status: "previsto" })).toThrow(
      "previsto exige data de vencimento",
    );
  });

  it("realizado exige pagamento", () => {
    expect(() => validarLancamento({ ...base, status: "realizado" })).toThrow(
      "realizado exige data de pagamento",
    );
  });

  it("aceita previsto com vencimento", () => {
    const resultado = validarLancamento({
      ...base,
      status: "previsto",
      dataVencimento: "2026-08-10",
    });
    expect(resultado.status).toBe("previsto");
    expect(resultado.dataVencimento).toBe("2026-08-10");
  });

  it("aceita realizado com pagamento", () => {
    const resultado = validarLancamento({
      ...base,
      status: "realizado",
      dataPagamento: "2026-07-05",
    });
    expect(resultado.dataPagamento).toBe("2026-07-05");
  });

  it("exige categoria", () => {
    expect(() =>
      validarLancamento({
        ...base,
        categoriaId: "",
        status: "realizado",
        dataPagamento: "2026-07-05",
      }),
    ).toThrow("Categoria é obrigatória.");
  });
});

describe("estaConciliado / podeExcluirOuAlterarValor", () => {
  it("conciliado quando tem extratoTransacaoId", () => {
    expect(estaConciliado({ extratoTransacaoId: "tx-1" })).toBe(true);
    expect(estaConciliado({ extratoTransacaoId: null })).toBe(false);
  });

  it("não pode excluir/alterar valor quando conciliado", () => {
    expect(podeExcluirOuAlterarValor({ extratoTransacaoId: "tx-1" })).toBe(false);
    expect(podeExcluirOuAlterarValor({ extratoTransacaoId: null })).toBe(true);
  });
});

describe("baixarLancamento", () => {
  it("transiciona previsto para realizado", () => {
    expect(baixarLancamento({ status: "previsto" }, "2026-07-05")).toEqual({
      status: "realizado",
      dataPagamento: "2026-07-05",
    });
  });

  it("rejeita baixar lançamento já realizado", () => {
    expect(() => baixarLancamento({ status: "realizado" }, "2026-07-05")).toThrow(
      "Só é possível dar baixa em lançamento previsto.",
    );
  });

  it("exige data de pagamento", () => {
    expect(() => baixarLancamento({ status: "previsto" }, "")).toThrow(
      "Data de pagamento é obrigatória",
    );
  });
});

describe("estornarBaixa", () => {
  it("transiciona realizado para previsto", () => {
    expect(
      estornarBaixa({
        status: "realizado",
        extratoTransacaoId: null,
        dataVencimento: "2026-08-10",
      }),
    ).toEqual({ status: "previsto", dataPagamento: null });
  });

  it("rejeita estornar lançamento previsto", () => {
    expect(() =>
      estornarBaixa({ status: "previsto", extratoTransacaoId: null, dataVencimento: "2026-08-10" }),
    ).toThrow("Só é possível estornar baixa de lançamento realizado.");
  });

  it("bloqueia estorno de lançamento conciliado", () => {
    expect(() =>
      estornarBaixa({
        status: "realizado",
        extratoTransacaoId: "tx-1",
        dataVencimento: "2026-08-10",
      }),
    ).toThrow("conciliado");
  });

  it("bloqueia estorno sem vencimento original", () => {
    expect(() =>
      estornarBaixa({ status: "realizado", extratoTransacaoId: null, dataVencimento: null }),
    ).toThrow("sem vencimento original");
  });
});
