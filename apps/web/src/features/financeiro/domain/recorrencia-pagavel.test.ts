import { describe, expect, it } from "vitest";
import { totalMensalRecorrencias, validarRecorrencia } from "./recorrencia-pagavel";
import type { RecorrenciaItem } from "./recorrencia-pagavel";

const base = {
  descricao: "Aluguel",
  valorCentavos: 300000,
  diaVencimento: 5,
  categoriaId: "cat-1",
};

describe("validarRecorrencia", () => {
  it("exige descricao", () => {
    expect(() => validarRecorrencia({ ...base, descricao: " " })).toThrow(
      "Descrição é obrigatória.",
    );
  });

  it("rejeita valor zero", () => {
    expect(() => validarRecorrencia({ ...base, valorCentavos: 0 })).toThrow(
      "Valor deve ser maior que zero.",
    );
  });

  it("rejeita dia fora de 1-28", () => {
    expect(() => validarRecorrencia({ ...base, diaVencimento: 31 })).toThrow(
      "Dia de vencimento deve ser entre 1 e 28.",
    );
  });

  it("exige categoria", () => {
    expect(() => validarRecorrencia({ ...base, categoriaId: "" })).toThrow(
      "Categoria é obrigatória.",
    );
  });

  it("aceita recorrencia valida", () => {
    expect(validarRecorrencia(base).descricao).toBe("Aluguel");
  });
});

describe("totalMensalRecorrencias", () => {
  it("soma so ativas", () => {
    const recorrencias: RecorrenciaItem[] = [
      {
        id: "1",
        descricao: "A",
        valorCentavos: 1000,
        diaVencimento: 5,
        categoriaId: "c",
        fornecedorId: null,
        contaId: null,
        ativo: true,
      },
      {
        id: "2",
        descricao: "B",
        valorCentavos: 2000,
        diaVencimento: 5,
        categoriaId: "c",
        fornecedorId: null,
        contaId: null,
        ativo: false,
      },
    ];
    expect(totalMensalRecorrencias(recorrencias)).toBe(1000);
  });
});
