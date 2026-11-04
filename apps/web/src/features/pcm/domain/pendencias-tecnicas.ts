export interface RespostaPreventiva {
  perguntaId: string;
  obrigatoria: boolean;
  resposta: "ok" | "nao_ok" | "nao_aplicavel" | "corrigido" | null;
  justificativa: string | null;
}
/** Prévia somente: não cria Pendências nem substitui validação PCM ou a conferência do checklist completo. */
export function avaliarRespostasPreventivas(respostas: readonly RespostaPreventiva[]): {
  candidatosNaoOk: string[];
  corrigidos: string[];
  ausentesObrigatorios: string[];
  naoAplicaveisSemJustificativa: string[];
  completa: boolean;
} {
  const ids = new Set<string>();
  const candidatosNaoOk: string[] = [];
  const corrigidos: string[] = [];
  const ausentesObrigatorios: string[] = [];
  const naoAplicaveisSemJustificativa: string[] = [];
  for (const item of respostas) {
    if (
      typeof item.perguntaId !== "string" ||
      !item.perguntaId.trim() ||
      item.perguntaId !== item.perguntaId.trim() ||
      ids.has(item.perguntaId) ||
      typeof item.obrigatoria !== "boolean" ||
      (item.justificativa !== null && typeof item.justificativa !== "string") ||
      ![null, "ok", "nao_ok", "nao_aplicavel", "corrigido"].includes(item.resposta)
    )
      throw new Error("Resposta preventiva inválida.");
    ids.add(item.perguntaId);
    if (item.resposta === "nao_ok") candidatosNaoOk.push(item.perguntaId);
    if (item.resposta === "corrigido") corrigidos.push(item.perguntaId);
    if (item.obrigatoria && item.resposta === null) ausentesObrigatorios.push(item.perguntaId);
    if (item.resposta === "nao_aplicavel" && !item.justificativa?.trim())
      naoAplicaveisSemJustificativa.push(item.perguntaId);
  }
  return {
    candidatosNaoOk,
    corrigidos,
    ausentesObrigatorios,
    naoAplicaveisSemJustificativa,
    completa:
      respostas.length > 0 &&
      ausentesObrigatorios.length === 0 &&
      naoAplicaveisSemJustificativa.length === 0,
  };
}

/** Projeção informativa apenas; o servidor deve comprovar validação, Cliente e origem antes de persistir. */
export function preverPendenciasDeRetornoValidado(retorno: {
  estado: "pendente" | "validada";
  clienteId: string;
  osId: string;
  ocorrenciaId: string;
  alvoId: string;
  validacaoId: string;
  respostas: readonly RespostaPreventiva[];
}) {
  if (
    retorno.estado !== "validada" ||
    [
      retorno.clienteId,
      retorno.osId,
      retorno.ocorrenciaId,
      retorno.alvoId,
      retorno.validacaoId,
    ].some((v) => typeof v !== "string" || !v.trim())
  ) {
    throw new Error("Retorno validado ou vínculo indisponível.");
  }
  const avaliacao = avaliarRespostasPreventivas(retorno.respostas);
  if (!avaliacao.completa) throw new Error("Respostas incompletas para conferência.");
  return {
    candidatos: avaliacao.candidatosNaoOk.map((perguntaId) => ({
      clienteId: retorno.clienteId,
      osId: retorno.osId,
      ocorrenciaId: retorno.ocorrenciaId,
      alvoId: retorno.alvoId,
      validacaoId: retorno.validacaoId,
      perguntaId,
    })),
    corrigidos: avaliacao.corrigidos,
  };
}
