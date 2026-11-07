/**
 * Decisão pura de programação; não grava intenção nem autoriza chamada ao Auvo.
 * O chamador deve obter a revisão e as identidades na transação proprietária da OS.
 */
export type ProgramacaoOs = {
  osId: string;
  tarefaAuvoId: string | null;
  inicioVisita: string | null;
};

export type IntencaoProgramacao =
  | { situacao: "demanda"; osId: string; tarefaAuvoId: string | null }
  | { situacao: "aguardar_confirmacao"; osId: string; tarefaAuvoId: string | null; inicioVisita: string; elegivelEm: string; operacao: "criar" | "atualizar" }
  | { situacao: "invalida"; motivo: "os_invalida" | "tarefa_invalida" | "inicio_invalido" };

const uuid = (valor: unknown): valor is string => typeof valor === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
const identidadeRemota = (valor: unknown): valor is string => typeof valor === "string" &&
  valor.length > 0 && valor.length <= 200 && valor.trim() === valor;

function instanteUtc(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!partes || partes[1] === "0000" || Number(partes[4]) > 23 || Number(partes[5]) > 59 || Number(partes[6]) > 59) return null;
  const civil = new Date(0);
  civil.setUTCFullYear(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  if (civil.getUTCFullYear() !== Number(partes[1]) || civil.getUTCMonth() !== Number(partes[2]) - 1 || civil.getUTCDate() !== Number(partes[3])) return null;
  const instante = Date.parse(valor);
  return Number.isFinite(instante) ? instante : null;
}

/** Preserva o ID remoto ao reprogramar ou retornar à Demanda, sem criar outra OS. */
export function prepararIntencaoProgramacao(programacao: ProgramacaoOs): IntencaoProgramacao {
  if (!programacao || !uuid(programacao.osId)) return { situacao: "invalida", motivo: "os_invalida" };
  if (programacao.tarefaAuvoId !== null && !identidadeRemota(programacao.tarefaAuvoId))
    return { situacao: "invalida", motivo: "tarefa_invalida" };
  if (programacao.inicioVisita === null)
    return { situacao: "demanda", osId: programacao.osId, tarefaAuvoId: programacao.tarefaAuvoId };
  const inicio = instanteUtc(programacao.inicioVisita);
  if (inicio === null) return { situacao: "invalida", motivo: "inicio_invalido" };
  return {
    situacao: "aguardar_confirmacao", osId: programacao.osId, tarefaAuvoId: programacao.tarefaAuvoId,
    inicioVisita: new Date(inicio).toISOString(), elegivelEm: new Date(inicio - 24 * 60 * 60 * 1000).toISOString(),
    operacao: programacao.tarefaAuvoId === null ? "criar" : "atualizar",
  };
}
