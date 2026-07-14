export type StatusUnidadeFerramenta = "disponivel" | "atribuida" | "baixada";
export type CondicaoDevolucao = "ok" | "danificada" | "perdida";
export type TipoMovimentacaoFerramenta = "atribuicao" | "devolucao" | "baixa";

export interface FerramentaUnidadeItem {
  id: string;
  ferramentaId: string;
  ferramentaNome: string;
  codigo: string;
  status: StatusUnidadeFerramenta;
  atribuidaA: string | null;
  atribuidaANome: string | null;
  atribuidaEm: string | null;
  motivoBaixa: string | null;
}

export interface MovimentacaoFerramentaItem {
  id: string;
  unidadeId: string;
  unidadeCodigo: string;
  ferramentaNome: string;
  tipo: TipoMovimentacaoFerramenta;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  condicao: CondicaoDevolucao | null;
  motivo: string | null;
  dataMovimento: string;
}

export interface AtribuirUnidadeFormData {
  unidadeId: string;
  funcionarioId: string;
}

export interface DevolverUnidadeFormData {
  unidadeId: string;
  condicao: CondicaoDevolucao;
  motivo?: string | null;
}

export interface BaixarUnidadeFormData {
  unidadeId: string;
  motivo: string;
}

export function rotuloStatusUnidade(status: StatusUnidadeFerramenta): string {
  if (status === "disponivel") return "Disponível";
  if (status === "atribuida") return "Atribuída";
  return "Baixada";
}

export function validarAtribuicaoUnidade(
  input: AtribuirUnidadeFormData,
  unidade?: FerramentaUnidadeItem,
): AtribuirUnidadeFormData {
  if (!input.unidadeId) throw new Error("Unidade é obrigatória.");
  if (!input.funcionarioId) throw new Error("Técnico é obrigatório.");
  if (!unidade) throw new Error("Unidade não encontrada.");
  if (unidade.status !== "disponivel") {
    throw new Error(
      `Unidade ${unidade.codigo} não está disponível (status atual: ${rotuloStatusUnidade(unidade.status)}).`,
    );
  }
  return input;
}

export function validarDevolucaoUnidade(
  input: DevolverUnidadeFormData,
  unidade?: FerramentaUnidadeItem,
): DevolverUnidadeFormData {
  if (!input.unidadeId) throw new Error("Unidade é obrigatória.");
  if (!unidade) throw new Error("Unidade não encontrada.");
  if (unidade.status !== "atribuida") {
    throw new Error(`Unidade ${unidade.codigo} não está atribuída no momento.`);
  }
  const motivo = input.motivo?.trim() || null;
  if ((input.condicao === "danificada" || input.condicao === "perdida") && !motivo) {
    throw new Error("Descreva o que aconteceu quando a condição não é OK.");
  }
  return { ...input, motivo };
}

export function validarBaixaUnidade(
  input: BaixarUnidadeFormData,
  unidade?: FerramentaUnidadeItem,
): BaixarUnidadeFormData {
  if (!input.unidadeId) throw new Error("Unidade é obrigatória.");
  if (!unidade) throw new Error("Unidade não encontrada.");
  if (unidade.status === "baixada") throw new Error(`Unidade ${unidade.codigo} já está baixada.`);
  const motivo = input.motivo.trim();
  if (!motivo) throw new Error("Motivo da baixa é obrigatório.");
  return { ...input, motivo };
}

/** AC-7: divergência é só um alerta de leitura — Auvo (agregado por técnico, `employeesStock`)
 * comparado à contagem real de unidades atribuídas no PCM pra aquele técnico. Nunca corrige nada
 * automaticamente. */
export function calcularDivergenciaAuvo(
  quantidadeAuvo: number,
  quantidadePcm: number,
): { divergente: boolean; diferenca: number } {
  const diferenca = quantidadeAuvo - quantidadePcm;
  return { divergente: diferenca !== 0, diferenca };
}
