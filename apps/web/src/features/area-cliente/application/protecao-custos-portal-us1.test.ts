import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projetarItensOrcamentoPublico } from "../domain/itens-orcamento-publico";

const fonte = readFileSync(
  resolve(__dirname, "../infrastructure/supabase-portal-adapter.ts"),
  "utf8",
);

describe("E01-S184 US1 (AC-1/AC-2): adapter do Portal nunca pede nem recebe custo", () => {
  it("lê propostas e orçamentos só pelas projeções públicas, nunca pela tabela/view privada", () => {
    expect(fonte).toContain('.from("portal_orcamentos_servico")');
    expect(fonte).toContain('.from("portal_propostas")');
    expect(fonte).not.toContain('.from("orcamentos_servico")');
    expect(fonte).not.toContain('.from("propostas")');
    expect(fonte).not.toContain('.from("proposta_itens")');
    expect(fonte).not.toContain('.from("proposta_versoes")');
  });

  it("nenhuma lista de colunas selecionada no adapter pede campo interno de custo", () => {
    for (const termo of [
      "custo_total_centavos",
      "custo_unitario_centavos",
      "piso_centavos",
      "preco_sugerido_centavos",
      "margem",
      "fornecedor",
      "comprovante_path",
    ]) {
      expect(fonte).not.toContain(termo);
    }
  });

  it("projeção pública de orçamento mantém só descrição/quantidade mesmo com custo sintético no dado bruto", () => {
    expect(
      projetarItensOrcamentoPublico([
        { descricao: "Peça", quantidade: 2, custo_centavos: 991234, valor_centavos: 881234 },
      ]),
    ).toEqual([{ descricao: "Peça", quantidade: 2 }]);
  });
});
