import { describe, expect, it } from "vitest";
import {
  type PropostaStatus,
  calcularTotalItem,
  estaExpirada,
  podeAvancarParaRevisao,
  podeEditar,
  proximaVersao,
  somarCustoItens,
  transicaoStatusInvalida,
} from "./proposta";

const TODOS_STATUS: PropostaStatus[] = [
  "rascunho",
  "em_revisao",
  "aprovada",
  "enviada",
  "aceita",
  "recusada",
  "cancelada",
];

describe("transicaoStatusInvalida", () => {
  it("aceita ficar no mesmo status (no-op)", () => {
    for (const status of TODOS_STATUS) {
      expect(transicaoStatusInvalida(status, status)).toBeNull();
    }
  });

  it("aceita todas as transições válidas do fluxo principal", () => {
    expect(transicaoStatusInvalida("rascunho", "em_revisao")).toBeNull();
    expect(transicaoStatusInvalida("em_revisao", "aprovada")).toBeNull();
    expect(transicaoStatusInvalida("aprovada", "enviada")).toBeNull();
    expect(transicaoStatusInvalida("enviada", "aceita")).toBeNull();
    expect(transicaoStatusInvalida("enviada", "recusada")).toBeNull();
  });

  it("aceita voltar de em_revisao para rascunho", () => {
    expect(transicaoStatusInvalida("em_revisao", "rascunho")).toBeNull();
  });

  it("aceita cancelar em qualquer etapa não-terminal", () => {
    expect(transicaoStatusInvalida("rascunho", "cancelada")).toBeNull();
    expect(transicaoStatusInvalida("em_revisao", "cancelada")).toBeNull();
    expect(transicaoStatusInvalida("aprovada", "cancelada")).toBeNull();
    expect(transicaoStatusInvalida("enviada", "cancelada")).toBeNull();
  });

  // Cobertura exaustiva: toda transição que NÃO está na lista de válidas acima precisa ser
  // recusada — é a garantia que a spec pede ("testar toda transição inválida, não só as válidas").
  it("recusa qualquer transição fora do fluxo permitido", () => {
    const validas = new Set([
      "rascunho>em_revisao",
      "rascunho>cancelada",
      "em_revisao>rascunho",
      "em_revisao>aprovada",
      "em_revisao>cancelada",
      "aprovada>enviada",
      "aprovada>cancelada",
      "enviada>aceita",
      "enviada>recusada",
      "enviada>cancelada",
    ]);
    let invalidasChecadas = 0;
    for (const de of TODOS_STATUS) {
      for (const para of TODOS_STATUS) {
        if (de === para) continue;
        const chave = `${de}>${para}`;
        if (validas.has(chave)) continue;
        expect(transicaoStatusInvalida(de, para), chave).not.toBeNull();
        invalidasChecadas++;
      }
    }
    // 7 status × 6 transições possíveis cada (excluindo self) = 42; 10 são válidas → 32 inválidas.
    expect(invalidasChecadas).toBe(32);
  });

  it("status terminal nunca transiciona pra outro lugar", () => {
    for (const terminal of ["aceita", "recusada", "cancelada"] as const) {
      for (const destino of TODOS_STATUS) {
        if (destino === terminal) continue;
        expect(transicaoStatusInvalida(terminal, destino)).toMatch(/Não é possível/);
      }
    }
  });
});

describe("podeEditar", () => {
  it("edita em rascunho, em_revisao e aprovada", () => {
    expect(podeEditar("rascunho")).toBe(true);
    expect(podeEditar("em_revisao")).toBe(true);
    expect(podeEditar("aprovada")).toBe(true);
  });

  // AC-7: enviada/aceita/recusada/cancelada são imutáveis.
  it("não edita nenhum status terminal ou enviada", () => {
    expect(podeEditar("enviada")).toBe(false);
    expect(podeEditar("aceita")).toBe(false);
    expect(podeEditar("recusada")).toBe(false);
    expect(podeEditar("cancelada")).toBe(false);
  });
});

describe("estaExpirada", () => {
  const hoje = new Date("2026-08-11T12:00:00.000Z");

  it("null nunca expira", () => {
    expect(estaExpirada(null, hoje)).toBe(false);
  });

  it("data no passado expira", () => {
    expect(estaExpirada("2026-08-10", hoje)).toBe(true);
  });

  it("data de hoje ainda não expira", () => {
    expect(estaExpirada("2026-08-11", hoje)).toBe(false);
  });

  it("data futura não expira", () => {
    expect(estaExpirada("2026-09-01", hoje)).toBe(false);
  });
});

describe("proximaVersao / somarCustoItens / calcularTotalItem", () => {
  it("incrementa a versão em 1", () => {
    expect(proximaVersao(1)).toBe(2);
    expect(proximaVersao(7)).toBe(8);
  });

  it("soma o total dos itens", () => {
    expect(
      somarCustoItens([{ totalCentavos: 1_000 }, { totalCentavos: 2_500 }, { totalCentavos: 0 }]),
    ).toBe(3_500);
  });

  it("lista vazia soma zero", () => {
    expect(somarCustoItens([])).toBe(0);
  });

  it("total do item é quantidade × custo unitário, arredondado", () => {
    expect(calcularTotalItem(2, 1_000)).toBe(2_000);
    expect(calcularTotalItem(1.5, 1_000)).toBe(1_500);
    expect(calcularTotalItem(1.333, 999)).toBe(Math.round(1.333 * 999));
  });
});

describe("podeAvancarParaRevisao", () => {
  // Caso de borda da spec: proposta sem item fica em rascunho, mas não avança.
  it("recusa avançar sem nenhum item", () => {
    expect(podeAvancarParaRevisao(0)).toBe(false);
  });

  it("permite avançar com ao menos um item", () => {
    expect(podeAvancarParaRevisao(1)).toBe(true);
  });
});
