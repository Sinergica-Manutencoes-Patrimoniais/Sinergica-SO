export interface ContextoTarefaAuvoInput {
  numeroOs: string;
  titulo: string;
  cliente: string;
  descricao?: string | null;
  endereco?: string | null;
  equipamento?: string | null;
  historico?: string[];
}

export interface ProdutoPrevistoTarefa {
  produtoId: string;
  quantidade: number;
  valor: number;
  descontoTipo?: number;
  descontoValor?: number;
}

/** Conteúdo neutro, sem HTML, para o anexo de contexto da tarefa Auvo quando o contrato de
 * attachments estiver validado. O gerador não faz I/O nem define o transporte (base64/URL). */
export function montarContextoTarefaAuvo(input: ContextoTarefaAuvoInput): string {
  const linhas = [
    `OS ${input.numeroOs} — ${input.titulo}`,
    `Cliente: ${input.cliente}`,
    input.endereco ? `Local: ${input.endereco}` : null,
    input.equipamento ? `Equipamento: ${input.equipamento}` : null,
    input.descricao ? `Descrição: ${input.descricao}` : null,
    input.historico?.length
      ? `Histórico relevante:\n${input.historico.map((item) => `- ${item}`).join("\n")}`
      : null,
  ];
  return linhas.filter((linha): linha is string => Boolean(linha)).join("\n\n");
}

/** Remove itens inválidos e adapta o vocabulário interno ao contrato documentado de
 * `PUT /tasks/{id}/products`. */
export function montarProdutosPrevistosAuvo(produtos: ProdutoPrevistoTarefa[]) {
  return produtos
    .filter(
      (produto) =>
        produto.produtoId.trim() &&
        Number.isFinite(produto.quantidade) &&
        produto.quantidade > 0 &&
        Number.isFinite(produto.valor) &&
        produto.valor >= 0,
    )
    .map((produto) => ({
      productId: produto.produtoId,
      quantity: produto.quantidade,
      value: produto.valor,
      discountType: produto.descontoTipo ?? 0,
      discountValue: produto.descontoValor ?? 0,
    }));
}
