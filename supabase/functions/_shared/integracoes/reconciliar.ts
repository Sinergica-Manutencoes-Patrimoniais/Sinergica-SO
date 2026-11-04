import { orientarRecuperacao, type ResultadoTentativa } from "./politica-recuperacao.ts";

/** Projeção de resultado comprovado pelo adaptador proprietário, sem payload remoto. */
export type ConsultaCandidatos = {
  origemId: string;
  versaoOrigem: number;
  consultaCompleta: boolean;
  identidadeConsultada: boolean;
  ausenciaComprovada: boolean;
  candidatos: readonly { id: string; correspondeOrigem: boolean }[];
};

export type ParecerConciliacao =
  | { situacao: "consulta_inconclusiva"; acao: "consultar_novamente" }
  | { situacao: "ausencia_comprovada"; acao: "solicitar_recuperacao_ao_proprietario" }
  | { situacao: "candidato_unico"; acao: "validar_vinculo_no_proprietario"; candidatoId: string }
  | { situacao: "conflito"; acao: "decisao_auditada" };

/**
 * Não faz consulta, não grava vínculo e não autoriza POST. A completude, ausência e
 * identidade são afirmações do adaptador, sujeitas a contrato, permissão e revisão atual.
 */
export function avaliarCandidatos(
  esperado: { origemId: string; versaoOrigem: number },
  consulta: ConsultaCandidatos,
): ParecerConciliacao {
  if (!esperado.origemId.trim() || !Number.isSafeInteger(esperado.versaoOrigem) || esperado.versaoOrigem < 1 ||
    consulta.origemId !== esperado.origemId || consulta.versaoOrigem !== esperado.versaoOrigem)
    throw new Error("Origem ou versão divergente.");
  if (typeof consulta.consultaCompleta !== "boolean" || typeof consulta.identidadeConsultada !== "boolean" ||
    typeof consulta.ausenciaComprovada !== "boolean" || !Array.isArray(consulta.candidatos) || consulta.candidatos.length > 1000 ||
    consulta.candidatos.some((c) => !c || typeof c.id !== "string" || !c.id.trim() || typeof c.correspondeOrigem !== "boolean"))
    throw new Error("Candidatos inválidos.");
  const ids = new Set(consulta.candidatos.map((c) => c.id));
  if (ids.size !== consulta.candidatos.length) throw new Error("Candidatos duplicados.");
  if (!consulta.consultaCompleta || !consulta.identidadeConsultada)
    return { situacao: "consulta_inconclusiva", acao: "consultar_novamente" };
  if (consulta.candidatos.length === 0) return consulta.ausenciaComprovada
    ? { situacao: "ausencia_comprovada", acao: "solicitar_recuperacao_ao_proprietario" }
    : { situacao: "consulta_inconclusiva", acao: "consultar_novamente" };
  if (consulta.ausenciaComprovada) throw new Error("Ausência contradiz candidatos.");
  if (consulta.candidatos.length !== 1 || !consulta.candidatos[0]!.correspondeOrigem)
    return { situacao: "conflito", acao: "decisao_auditada" };
  return { situacao: "candidato_unico", acao: "validar_vinculo_no_proprietario", candidatoId: consulta.candidatos[0]!.id };
}

export type PlanoRecuperacao =
  | { acao: "consultar_novamente" }
  | { acao: "validar_vinculo_no_proprietario"; candidatoId: string }
  | { acao: "decisao_auditada" }
  | { acao: "revisao_manual" }
  | { acao: "delegar_retry"; naoAntesDeMs: number };

/**
 * Combina consulta de identidade com a política de falha. Não grava, despacha ou
 * comprova a busca: o proprietário deve fornecer fatos confiáveis e revalidar
 * autorização, revisão, idempotência e ausência imediatamente antes do efeito.
 */
export function planejarRecuperacao(
  esperado: { origemId: string; versaoOrigem: number },
  consulta: ConsultaCandidatos,
  tentativa: ResultadoTentativa,
): PlanoRecuperacao {
  const candidatos = avaliarCandidatos(esperado, consulta);
  if (candidatos.situacao === "consulta_inconclusiva") return { acao: "consultar_novamente" };
  if (candidatos.situacao === "candidato_unico") return { acao: "validar_vinculo_no_proprietario", candidatoId: candidatos.candidatoId };
  if (candidatos.situacao === "conflito") return { acao: "decisao_auditada" };
  const orientacao = orientarRecuperacao(tentativa);
  if (orientacao.acao === "conciliar") return { acao: "consultar_novamente" };
  return orientacao;
}
