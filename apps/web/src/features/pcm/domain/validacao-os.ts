export type ResultadoResposta =
  | "ok"
  | "nao_ok"
  | "nao_aplicavel"
  | "nao_inspecionado"
  | "corrigido";
export const RESULTADOS_RESPOSTA: readonly ResultadoResposta[] = [
  "ok",
  "nao_ok",
  "nao_aplicavel",
  "nao_inspecionado",
  "corrigido",
];

export interface PerguntaRetorno {
  id: string;
  texto: string | null;
}
export interface RespostaPergunta {
  perguntaId: string;
  resultado: ResultadoResposta;
  observacao: string | null;
}

/** Espelha a regra do servidor (`sso_classificar_retorno_campo_manual`): nunca prova cobertura por
 * si só — é só uma prévia pra UI não deixar o PCM enviar resposta claramente inválida. */
export function respostaValida(resposta: RespostaPergunta): boolean {
  if (resposta.observacao !== null && resposta.observacao.length > 4000) return false;
  if (resposta.resultado === "nao_aplicavel" && !resposta.observacao?.trim()) return false;
  return true;
}

export function perguntasNaoRespondidas(
  perguntas: readonly PerguntaRetorno[],
  respostas: readonly RespostaPergunta[],
): string[] {
  const respondidas = new Set(respostas.map((r) => r.perguntaId));
  return perguntas.filter((p) => !respondidas.has(p.id)).map((p) => p.id);
}

export function classificacaoCompleta(
  perguntas: readonly PerguntaRetorno[],
  respostas: readonly RespostaPergunta[],
): boolean {
  return perguntasNaoRespondidas(perguntas, respostas).length === 0;
}

/** Perguntas Não OK formam Pendência Técnica no servidor; "opcional não inspecionada" nunca forma
 * (ver `E01-S168_opcional_aprovacao.test.sql`). Só uma prévia informativa pra UI, não decide nada. */
export function geraPendenciaTecnica(resposta: RespostaPergunta): boolean {
  return resposta.resultado === "nao_ok";
}
