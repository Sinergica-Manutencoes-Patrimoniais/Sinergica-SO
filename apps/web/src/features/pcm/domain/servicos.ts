export interface ServicoItem {
  id: string;
  titulo: string;
  descricao: string | null;
  precoCentavos: number;
  ativo: boolean;
  auvoId: string | null;
  auvoSyncStatus: string | null;
  auvoSyncError: string | null;
  auvoSyncedAt: string | null;
}

export interface ServicoFormData {
  titulo: string;
  descricao?: string | null;
  precoCentavos: number;
}

export function validarServico(input: ServicoFormData): ServicoFormData {
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Título é obrigatório.");
  if (!Number.isInteger(input.precoCentavos) || input.precoCentavos <= 0) {
    throw new Error("Preço deve ser maior que zero.");
  }
  return {
    titulo,
    descricao: textoOuNull(input.descricao),
    precoCentavos: input.precoCentavos,
  };
}

export function reaisParaCentavos(value: string): number {
  const normalizado = value.trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100);
}

export function centavosParaReais(value: number): string {
  return (value / 100).toFixed(2).replace(".", ",");
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
