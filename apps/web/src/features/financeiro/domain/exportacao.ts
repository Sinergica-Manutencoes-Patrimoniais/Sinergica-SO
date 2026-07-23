import type { LancamentoItem } from "./lancamento";

export interface DicionariosExportacao {
  categoriaPorId: Map<string, string>;
  contaPorId: Map<string, string>;
  clientePorId: Map<string, string>;
}

/** AC-1/AC-4: CSV do período pra entregar ao contador — mesma fonte do dashboard (lê de
 * `LancamentoItem[]`, o mesmo array que a tela de Lançamentos já busca via `listarLancamentos`).
 * Pura (sem I/O) pra ser testável sem mockar Blob/download. Escapa `;`/quebra de linha/aspas
 * (RFC 4180) — planilhas PT-BR usam `;` como separador padrão (vírgula é decimal). */
export function gerarCsvLancamentos(
  lancamentos: LancamentoItem[],
  dicionarios: DicionariosExportacao,
): string {
  const cabecalho = [
    "Competência",
    "Tipo",
    "Status",
    "Valor (R$)",
    "Categoria",
    "Conta",
    "Cliente",
    "Vencimento",
    "Pagamento",
    "Descrição",
  ];
  const linhas = lancamentos.map((l) => [
    l.dataCompetencia,
    l.tipo === "entrada" ? "Entrada" : "Saída",
    l.status === "previsto" ? "Previsto" : "Realizado",
    (l.valorCentavos / 100).toFixed(2).replace(".", ","),
    dicionarios.categoriaPorId.get(l.categoriaId) ?? "",
    l.contaId ? (dicionarios.contaPorId.get(l.contaId) ?? "") : "",
    l.clienteId ? (dicionarios.clientePorId.get(l.clienteId) ?? "") : "",
    l.dataVencimento ?? "",
    l.dataPagamento ?? "",
    l.descricao ?? "",
  ]);

  return [cabecalho, ...linhas].map((campos) => campos.map(escaparCsv).join(";")).join("\r\n");
}

function escaparCsv(valor: string): string {
  if (valor.includes(";") || valor.includes('"') || valor.includes("\n")) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}
