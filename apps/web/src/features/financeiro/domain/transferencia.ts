export interface TransferenciaFormData {
  contaOrigemId: string;
  contaDestinoId: string;
  valorCentavos: number;
  data: string;
  descricao?: string | null;
}

export function validarTransferencia(input: TransferenciaFormData): TransferenciaFormData {
  if (!input.contaOrigemId || !input.contaDestinoId) {
    throw new Error("Conta de origem e destino são obrigatórias.");
  }
  if (input.contaOrigemId === input.contaDestinoId) {
    throw new Error("Conta de origem e destino não podem ser a mesma.");
  }
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) {
    throw new Error("Valor deve ser maior que zero.");
  }
  if (!input.data) throw new Error("Data é obrigatória.");
  return { ...input, descricao: textoOuNull(input.descricao) };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
