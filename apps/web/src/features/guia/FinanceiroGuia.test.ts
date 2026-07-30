import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guia = readFileSync(new URL("./FinanceiroGuia.tsx", import.meta.url), "utf8");

describe("Guia SO — Financeiro", () => {
  it("documenta todas as opções reais da navegação financeira", () => {
    const opcoes = [
      "Dashboard",
      "Lançamentos",
      "Categorias",
      "Contas Bancárias",
      "Importar Extrato",
      "Contas a Receber",
      "Contratos",
      "Cobrança",
      "Contas a Pagar",
      "Impostos",
      "Fechamento Mensal",
      "Rentabilidade",
      "Custos de Pessoal",
      "DRE",
      "Orçamento",
      "Cockpit",
    ];

    for (const opcao of opcoes) {
      expect(guia).toContain(`nome: "${opcao}"`);
    }
  });

  it("explica uso e sentido com status de dado real", () => {
    expect(guia).toContain('<StatusModulo status="real" />');
    expect(guia).toContain("Para que serve");
    expect(guia).toContain("Como usar");
    expect(guia).toContain("Qual o sentido");
    expect(guia).toContain("Competência × caixa");
    expect(guia).not.toContain('<StatusModulo status="prototipo" />');
    expect(guia).not.toContain("dado fictício");
  });
});
