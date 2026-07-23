export type CanalCobranca = "whatsapp" | "email" | "ambos";

export interface PontoReguaItem {
  id: string;
  diaOffset: number;
  canal: CanalCobranca;
  mensagemModelo: string;
  ativo: boolean;
}

export interface PontoReguaFormData {
  diaOffset: number;
  canal: CanalCobranca;
  mensagemModelo: string;
}

export interface EnvioReguaItem {
  id: string;
  lancamentoId: string;
  pontoId: string;
  canalEfetivo: CanalCobranca | null;
  status: "enviado" | "erro" | "sem_canal";
  motivo: string | null;
  enviadoEm: string;
}

/** Label AC-1 (D-3/D+3/D+7/D+15): negativo = antes do vencimento, positivo = depois. */
export function labelDiaOffset(diaOffset: number): string {
  if (diaOffset === 0) return "No vencimento";
  return diaOffset > 0 ? `D+${diaOffset}` : `D${diaOffset}`;
}

export function validarPontoRegua(input: PontoReguaFormData): PontoReguaFormData {
  if (!Number.isInteger(input.diaOffset))
    throw new Error("Dia da régua deve ser um número inteiro.");
  if (!input.mensagemModelo?.trim()) throw new Error("Mensagem-modelo é obrigatória.");
  return input;
}

/** AC-2/AC-3: um ponto "atinge" quando hoje já alcançou vencimento+offset — `>=` (não `===`) faz
 * catch-up se o cron não rodou num dia; a não-duplicação real fica a cargo do registro de envio
 * (unique lancamento+ponto no banco), não desta função. */
export function pontoAtingido(dataVencimento: string, diaOffset: number, hoje: string): boolean {
  const alvo = new Date(dataVencimento);
  alvo.setUTCDate(alvo.getUTCDate() + diaOffset);
  return new Date(hoje) >= alvo;
}

export function interpolarMensagem(
  modelo: string,
  dados: { cliente: string; valorFormatado: string; vencimentoFormatado: string },
): string {
  return modelo
    .replaceAll("{{cliente}}", dados.cliente)
    .replaceAll("{{valor}}", dados.valorFormatado)
    .replaceAll("{{vencimento}}", dados.vencimentoFormatado);
}
