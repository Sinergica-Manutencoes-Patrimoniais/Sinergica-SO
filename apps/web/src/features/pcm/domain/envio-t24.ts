export type ContextoEnvioT24 = {
  agora: string;
  inicioVisita: string | null;
  estadoVisita: "confirmada" | "planejada" | "cancelada" | "concluida";
  revisaoVisita: number;
  revisaoConfirmada: number | null;
  politicaCiencia: "nao_exigida" | "obrigatoria";
  cienciaConfirmada: boolean;
  estadoOs: "aberta" | "encerrada" | "cancelada";
  integracao: "sem_tarefa" | "atualizacao_pendente" | "sincronizada" | "incerto";
  tarefaId: string | null;
  contratoComprovado: boolean;
  camposComprovados: boolean;
};
type ResultadoEnvio =
  | { situacao: "bloqueada"; motivo: string }
  | { situacao: "aguardando"; elegivelEm: string }
  | { situacao: "elegivel"; operacao: "criar" | "atualizar" }
  | { situacao: "sem_acao" };

/** Classifica dados alegados pelo chamador; não comprova ausência nem autoriza criar ou retry. */
export function avaliarReconciliacaoTarefa(entrada: {
  buscaCompleta: boolean;
  candidatos: readonly string[];
}):
  | { situacao: "incerto"; motivo: "busca_incompleta" | "candidatos_invalidos" }
  | { situacao: "nenhum_candidato" }
  | { situacao: "candidato_unico"; tarefaId: string }
  | { situacao: "decisao_necessaria"; candidatos: string[] } {
  if (entrada.buscaCompleta !== true) return { situacao: "incerto", motivo: "busca_incompleta" };
  if (
    entrada.candidatos.some((id) => typeof id !== "string" || !id || id !== id.trim()) ||
    new Set(entrada.candidatos).size !== entrada.candidatos.length
  )
    return { situacao: "incerto", motivo: "candidatos_invalidos" };
  if (entrada.candidatos.length === 0) return { situacao: "nenhum_candidato" };
  if (entrada.candidatos.length === 1 && entrada.candidatos[0] !== undefined)
    return { situacao: "candidato_unico", tarefaId: entrada.candidatos[0] };
  return { situacao: "decisao_necessaria", candidatos: [...entrada.candidatos] };
}

function instante(texto: string): number {
  const formato =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
  const partes = formato.exec(texto);
  if (!partes || partes[1] === "0000") throw new Error("Instante inválido.");
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const civil = new Date(0);
  civil.setUTCFullYear(ano, mes - 1, dia);
  if (
    civil.getUTCFullYear() !== ano ||
    civil.getUTCMonth() !== mes - 1 ||
    civil.getUTCDate() !== dia
  )
    throw new Error("Instante inválido.");
  const valor = Date.parse(texto);
  if (
    !Number.isFinite(valor) ||
    Number(partes[4]) > 23 ||
    Number(partes[5]) > 59 ||
    Number(partes[6]) > 59
  )
    throw new Error("Instante inválido.");
  return valor;
}

/** Pré-condição informativa, não autoriza rede nem substitui validação atômica do servidor. */
export function avaliarEnvioT24(c: ContextoEnvioT24): ResultadoEnvio {
  if (c.estadoVisita !== "confirmada")
    return { situacao: "bloqueada", motivo: "visita_inelegivel" };
  if (
    !Number.isSafeInteger(c.revisaoVisita) ||
    c.revisaoVisita < 1 ||
    c.revisaoConfirmada !== c.revisaoVisita
  )
    return { situacao: "bloqueada", motivo: "confirmacao_invalida" };
  if (c.estadoOs !== "aberta") return { situacao: "bloqueada", motivo: "os_inelegivel" };
  if (
    c.politicaCiencia !== "nao_exigida" &&
    (c.politicaCiencia !== "obrigatoria" || c.cienciaConfirmada !== true)
  )
    return { situacao: "bloqueada", motivo: "ciencia_pendente" };
  if (c.integracao === "incerto")
    return { situacao: "bloqueada", motivo: "reconciliacao_pendente" };
  if (
    (c.integracao === "sem_tarefa" && c.tarefaId !== null) ||
    ((c.integracao === "sincronizada" || c.integracao === "atualizacao_pendente") &&
      !c.tarefaId?.trim())
  )
    return { situacao: "bloqueada", motivo: "reconciliacao_pendente" };
  if (c.inicioVisita === null) return { situacao: "bloqueada", motivo: "sem_data" };
  if (c.integracao === "sincronizada") return { situacao: "sem_acao" };
  if (c.integracao !== "sem_tarefa" && c.integracao !== "atualizacao_pendente")
    return { situacao: "bloqueada", motivo: "reconciliacao_pendente" };
  if (c.contratoComprovado !== true || c.camposComprovados !== true)
    return { situacao: "bloqueada", motivo: "contrato_nao_comprovado" };
  const limite = instante(c.inicioVisita) - 24 * 60 * 60 * 1000;
  const agora = instante(c.agora);
  if (agora < limite) return { situacao: "aguardando", elegivelEm: new Date(limite).toISOString() };
  return { situacao: "elegivel", operacao: c.integracao === "sem_tarefa" ? "criar" : "atualizar" };
}
