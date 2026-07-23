export type ContratoStatus = "ativo" | "suspenso" | "encerrado";

export interface ContratoItem {
  id: string;
  clienteId: string;
  descricao: string | null;
  valorMensalCentavos: number;
  diaVencimento: number;
  inicio: string;
  fim: string | null;
  status: ContratoStatus;
  bloqueiaOsEmAtraso: boolean;
}

export interface ContratoFormData {
  clienteId: string;
  descricao?: string | null;
  valorMensalCentavos: number;
  diaVencimento: number;
  inicio: string;
  fim?: string | null;
  status: ContratoStatus;
  bloqueiaOsEmAtraso: boolean;
}

export function validarContrato(input: ContratoFormData): ContratoFormData {
  if (!input.clienteId) throw new Error("Cliente é obrigatório.");
  if (!Number.isInteger(input.valorMensalCentavos) || input.valorMensalCentavos <= 0) {
    throw new Error("Valor mensal deve ser maior que zero.");
  }
  if (
    !Number.isInteger(input.diaVencimento) ||
    input.diaVencimento < 1 ||
    input.diaVencimento > 28
  ) {
    throw new Error("Dia de vencimento deve ser entre 1 e 28.");
  }
  if (!input.inicio) throw new Error("Início é obrigatório.");
  const fim = input.fim?.trim() || null;
  if (fim && fim < input.inicio) throw new Error("Fim não pode ser antes do início.");

  return {
    clienteId: input.clienteId,
    descricao: textoOuNull(input.descricao),
    valorMensalCentavos: input.valorMensalCentavos,
    diaVencimento: input.diaVencimento,
    inicio: input.inicio,
    fim,
    status: input.status,
    bloqueiaOsEmAtraso: input.bloqueiaOsEmAtraso,
  };
}

export function receitaMensalPrevista(contratos: ContratoItem[]): number {
  return contratos
    .filter((c) => c.status === "ativo")
    .reduce((soma, c) => soma + c.valorMensalCentavos, 0);
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
