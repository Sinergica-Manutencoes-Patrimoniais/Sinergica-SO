import { describe, expect, it } from "vitest";
import { gerarCsvLancamentos } from "./exportacao";
import type { LancamentoItem } from "./lancamento";

const dicionariosVazios = {
  categoriaPorId: new Map(),
  contaPorId: new Map(),
  clientePorId: new Map(),
};

function lancamento(overrides: Partial<LancamentoItem> = {}): LancamentoItem {
  return {
    id: "l1",
    tipo: "entrada",
    status: "realizado",
    valorCentavos: 15050,
    dataCompetencia: "2026-07-01",
    dataVencimento: null,
    dataPagamento: "2026-07-05",
    categoriaId: "cat1",
    contaId: null,
    clienteId: null,
    fornecedorId: null,
    osId: null,
    origem: "manual",
    extratoTransacaoId: null,
    descricao: null,
    comprovantePath: null,
    ...overrides,
  };
}

describe("gerarCsvLancamentos", () => {
  it("gera cabeçalho mesmo com lista vazia (edge case: exportar período sem dados)", () => {
    const csv = gerarCsvLancamentos([], dicionariosVazios);
    expect(csv).toBe(
      "Competência;Tipo;Status;Valor (R$);Categoria;Conta;Cliente;Vencimento;Pagamento;Descrição",
    );
  });

  it("formata valor em vírgula decimal e resolve nomes via dicionários", () => {
    const csv = gerarCsvLancamentos(
      [lancamento({ categoriaId: "cat1", contaId: "conta1", clienteId: "cli1" })],
      {
        categoriaPorId: new Map([["cat1", "Receita de contrato"]]),
        contaPorId: new Map([["conta1", "Itaú PJ"]]),
        clientePorId: new Map([["cli1", "Condomínio X"]]),
      },
    );
    const linha = csv.split("\r\n")[1];
    expect(linha).toBe(
      "2026-07-01;Entrada;Realizado;150,50;Receita de contrato;Itaú PJ;Condomínio X;;2026-07-05;",
    );
  });

  it("escapa campo com ponto e vírgula (RFC 4180)", () => {
    const csv = gerarCsvLancamentos(
      [lancamento({ descricao: "Pagamento; parcela 1" })],
      dicionariosVazios,
    );
    expect(csv).toContain('"Pagamento; parcela 1"');
  });
});
