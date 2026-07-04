import { describe, expect, it } from "vitest";
import { ehStatusEmAberto, ehStatusHistorico, rotuloOuPlaceholder } from "./cliente-360";

// specs/E01-S12-visao-360-cliente — AC-2, AC-3, AC-4

describe("ehStatusHistorico / ehStatusEmAberto", () => {
  // AC-3: status em aberto (backlog) — inclui em_execucao (AUTO-DECISION #1)
  it("AC-3: solicitacao, planejamento e em_execucao são 'em aberto'", () => {
    for (const status of ["solicitacao", "planejamento", "em_execucao"]) {
      expect(ehStatusEmAberto(status)).toBe(true);
      expect(ehStatusHistorico(status)).toBe(false);
    }
  });

  // AC-4: status histórico — finalizado e cancelado
  it("AC-4: finalizado e cancelado são 'histórico'", () => {
    for (const status of ["finalizado", "cancelado"]) {
      expect(ehStatusHistorico(status)).toBe(true);
      expect(ehStatusEmAberto(status)).toBe(false);
    }
  });

  // Invariante: complementares — nenhuma OS fica fora dos dois painéis
  it("são estritamente complementares para qualquer status", () => {
    for (const status of [
      "solicitacao",
      "planejamento",
      "em_execucao",
      "finalizado",
      "cancelado",
    ]) {
      expect(ehStatusEmAberto(status)).toBe(!ehStatusHistorico(status));
    }
  });

  it("status desconhecido cai no bucket 'em aberto' (nunca some da tela)", () => {
    expect(ehStatusEmAberto("qualquer_status_novo")).toBe(true);
    expect(ehStatusHistorico("qualquer_status_novo")).toBe(false);
  });
});

describe("rotuloOuPlaceholder", () => {
  // AC-2: cnpj/auvo_id nulos → rótulo neutro, sem quebrar
  it("AC-2: valor nulo/undefined vira o placeholder", () => {
    expect(rotuloOuPlaceholder(null, "—")).toBe("—");
    expect(rotuloOuPlaceholder(undefined, "não sincronizado")).toBe("não sincronizado");
  });

  it("AC-2: string em branco vira o placeholder", () => {
    expect(rotuloOuPlaceholder("", "—")).toBe("—");
    expect(rotuloOuPlaceholder("   ", "—")).toBe("—");
  });

  it("AC-2: valor presente (string ou número) é exibido como texto", () => {
    expect(rotuloOuPlaceholder("12.345.678/0001-99", "—")).toBe("12.345.678/0001-99");
    expect(rotuloOuPlaceholder(987654, "—")).toBe("987654");
    expect(rotuloOuPlaceholder(0, "—")).toBe("0");
  });
});
