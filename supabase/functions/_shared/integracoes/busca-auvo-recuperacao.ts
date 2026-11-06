import { avaliarBuscaTarefa, type BuscaTarefaPorIdentidade } from "../auvo/reconciliar-task.ts";
import type { ConsultaCandidatos } from "./reconciliar.ts";

/**
 * Traduz a busca de identidade do fluxo T−24 sem inventar completude,
 * correspondência ou ausência. A busca e a revisão devem ser obtidas e
 * validadas pelo proprietário; esta função não chama Auvo nem grava vínculos.
 */
export function adaptarBuscaAuvo(
  origem: { origemId: string; versaoOrigem: number },
  busca: BuscaTarefaPorIdentidade,
  correspondenciasVerificadas: readonly string[],
): ConsultaCandidatos {
  if (typeof origem.origemId !== "string" || !origem.origemId.trim() ||
    !Number.isSafeInteger(origem.versaoOrigem) || origem.versaoOrigem < 1)
    throw new Error("Origem de recuperação inválida.");
  const decisao = avaliarBuscaTarefa(busca);
  if (decisao.situacao === "reconciliacao" && decisao.motivo === "busca_inconclusiva")
    return { ...origem, consultaCompleta: false, identidadeConsultada: false, ausenciaComprovada: false, candidatos: [] };
  if (busca.candidatos.length > 1000)
    return { ...origem, consultaCompleta: false, identidadeConsultada: false, ausenciaComprovada: false, candidatos: [] };
  if (!Array.isArray(correspondenciasVerificadas) ||
    new Set(correspondenciasVerificadas).size !== correspondenciasVerificadas.length ||
    correspondenciasVerificadas.some((id) => !busca.candidatos.includes(id)))
    throw new Error("Correspondências inválidas.");
  const correspondencias = new Set(correspondenciasVerificadas);
  return {
    ...origem,
    consultaCompleta: true,
    identidadeConsultada: true,
    ausenciaComprovada: decisao.situacao === "ausencia_comprovada",
    candidatos: busca.candidatos.map((id) => ({ id, correspondeOrigem: correspondencias.has(id) })),
  };
}
