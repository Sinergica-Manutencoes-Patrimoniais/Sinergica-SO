export type LancamentoTipo = "entrada" | "saida";
export type LancamentoStatus = "previsto" | "realizado";
export type LancamentoOrigem = "manual" | "ofx" | "recorrencia" | "transferencia";

export interface LancamentoItem {
  id: string;
  tipo: LancamentoTipo;
  status: LancamentoStatus;
  valorCentavos: number;
  dataCompetencia: string;
  dataVencimento: string | null;
  dataPagamento: string | null;
  categoriaId: string;
  contaId: string | null;
  clienteId: string | null;
  fornecedorId: string | null;
  osId: string | null;
  origem: LancamentoOrigem;
  /** Preenchido = lançamento conciliado (E04-S02). Enquanto S02 não existe, sempre null. */
  extratoTransacaoId: string | null;
  descricao: string | null;
  comprovantePath: string | null;
}

export interface LancamentoFormData {
  tipo: LancamentoTipo;
  status: LancamentoStatus;
  valorCentavos: number;
  dataCompetencia: string;
  dataVencimento?: string | null;
  dataPagamento?: string | null;
  categoriaId: string;
  contaId?: string | null;
  clienteId?: string | null;
  fornecedorId?: string | null;
  descricao?: string | null;
}

/** É "conciliado" — estado derivado, não um terceiro valor de status (domain.md). Lançamento
 * conciliado não pode ser excluído nem ter valor/conta alterados. */
export function estaConciliado(lancamento: Pick<LancamentoItem, "extratoTransacaoId">): boolean {
  return lancamento.extratoTransacaoId !== null;
}

export function validarLancamento(input: LancamentoFormData): LancamentoFormData {
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
    throw new Error("Valor deve ser maior que zero.");
  }
  if (!input.categoriaId) throw new Error("Categoria é obrigatória.");
  if (!input.dataCompetencia) throw new Error("Competência é obrigatória.");

  const dataVencimento = textoOuNull(input.dataVencimento);
  const dataPagamento = textoOuNull(input.dataPagamento);

  if (input.status === "previsto" && !dataVencimento) {
    throw new Error("Lançamento previsto exige data de vencimento.");
  }
  if (input.status === "realizado" && !dataPagamento) {
    throw new Error("Lançamento realizado exige data de pagamento.");
  }

  return {
    tipo: input.tipo,
    status: input.status,
    valorCentavos: input.valorCentavos,
    dataCompetencia: input.dataCompetencia,
    dataVencimento,
    dataPagamento,
    categoriaId: input.categoriaId,
    contaId: textoOuNull(input.contaId),
    clienteId: textoOuNull(input.clienteId),
    fornecedorId: textoOuNull(input.fornecedorId),
    descricao: textoOuNull(input.descricao),
  };
}

export function podeExcluirOuAlterarValor(
  lancamento: Pick<LancamentoItem, "extratoTransacaoId">,
): boolean {
  return !estaConciliado(lancamento);
}

/** Transição previsto → realizado (AC-5). Exige a data de pagamento informada agora. */
export function baixarLancamento(
  lancamento: Pick<LancamentoItem, "status">,
  dataPagamento: string,
): { status: "realizado"; dataPagamento: string } {
  if (lancamento.status !== "previsto") {
    throw new Error("Só é possível dar baixa em lançamento previsto.");
  }
  if (!dataPagamento) throw new Error("Data de pagamento é obrigatória para dar baixa.");
  return { status: "realizado", dataPagamento };
}

/** Reverte a baixa: realizado → previsto (AC-5, reversível). Exige a data de vencimento original
 * para reconstruir o estado previsto (o form/adapter mantém essa data ao dar baixa). */
export function estornarBaixa(
  lancamento: Pick<LancamentoItem, "status" | "extratoTransacaoId" | "dataVencimento">,
): { status: "previsto"; dataPagamento: null } {
  if (lancamento.status !== "realizado") {
    throw new Error("Só é possível estornar baixa de lançamento realizado.");
  }
  if (estaConciliado(lancamento)) {
    throw new Error("Lançamento conciliado — desfaça a conciliação antes de estornar a baixa.");
  }
  if (!lancamento.dataVencimento) {
    throw new Error("Lançamento sem vencimento original não pode voltar a previsto.");
  }
  return { status: "previsto", dataPagamento: null };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
