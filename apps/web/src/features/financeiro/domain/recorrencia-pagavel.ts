export interface RecorrenciaItem {
  id: string;
  descricao: string;
  valorCentavos: number;
  diaVencimento: number;
  categoriaId: string;
  fornecedorId: string | null;
  contaId: string | null;
  ativo: boolean;
}

export interface RecorrenciaFormData {
  descricao: string;
  valorCentavos: number;
  diaVencimento: number;
  categoriaId: string;
  fornecedorId?: string | null;
  contaId?: string | null;
}

export function validarRecorrencia(input: RecorrenciaFormData): RecorrenciaFormData {
  const descricao = input.descricao.trim();
  if (!descricao) throw new Error("Descrição é obrigatória.");
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
    throw new Error("Valor deve ser maior que zero.");
  }
  if (
    !Number.isInteger(input.diaVencimento) ||
    input.diaVencimento < 1 ||
    input.diaVencimento > 28
  ) {
    throw new Error("Dia de vencimento deve ser entre 1 e 28.");
  }
  if (!input.categoriaId) throw new Error("Categoria é obrigatória.");

  return {
    descricao,
    valorCentavos: input.valorCentavos,
    diaVencimento: input.diaVencimento,
    categoriaId: input.categoriaId,
    fornecedorId: textoOuNull(input.fornecedorId),
    contaId: textoOuNull(input.contaId),
  };
}

export function totalMensalRecorrencias(recorrencias: RecorrenciaItem[]): number {
  return recorrencias.filter((r) => r.ativo).reduce((soma, r) => soma + r.valorCentavos, 0);
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
