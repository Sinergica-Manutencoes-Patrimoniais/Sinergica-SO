import type { ContratoItem } from "./contrato";

/** Mesma regra do RPC `financeiro.fn_gerar_recorrencias` (SQL), replicada pura em TS só pra
 * pré-visualização na UI (ex.: "N contratos vigentes nesta competência" antes de gerar). A fonte
 * de verdade da geração continua o RPC — isso aqui nunca grava nada. */
export function contratoVigenteNaCompetencia(
  contrato: Pick<ContratoItem, "status" | "inicio" | "fim">,
  competenciaIso: string,
): boolean {
  if (contrato.status !== "ativo") return false;
  const competencia = new Date(`${competenciaIso}T00:00:00`);
  const primeiroDiaMes = new Date(competencia.getFullYear(), competencia.getMonth(), 1);
  const ultimoDiaMes = new Date(competencia.getFullYear(), competencia.getMonth() + 1, 0);
  const inicio = new Date(`${contrato.inicio}T00:00:00`);
  if (inicio > ultimoDiaMes) return false;
  if (contrato.fim) {
    const fim = new Date(`${contrato.fim}T00:00:00`);
    if (fim < primeiroDiaMes) return false;
  }
  return true;
}

export function calcularVencimentoRecorrencia(
  competenciaIso: string,
  diaVencimento: number,
): string {
  const competencia = new Date(`${competenciaIso}T00:00:00`);
  const vencimento = new Date(competencia.getFullYear(), competencia.getMonth(), diaVencimento);
  return vencimento.toISOString().slice(0, 10);
}

export function contarVigentes(contratos: ContratoItem[], competenciaIso: string): number {
  return contratos.filter((c) => contratoVigenteNaCompetencia(c, competenciaIso)).length;
}
