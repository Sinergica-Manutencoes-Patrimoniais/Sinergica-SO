// trigger-automatico.ts — E02-S25. Decide se o Zé deve responder automaticamente (sem ser
// mencionado): fora do horário humano configurado, OU após X minutos sem resposta humana dentro
// dele. Pura, sem I/O — testável sem LLM/banco. Modelo unilateral (reunião 2026-07-27): um
// trigger ativa (esta função), outro desativa (handoff pro humano, já existente em
// `deveTransferirParaHumano`).

export interface ConfigTriggerAutomatico {
  ativo: boolean;
  /** Dias da semana (0=dom..6=sáb) em que humanos respondem. Vazio = nenhum dia (Zé sempre assume). */
  dias: number[];
  /** "HH:MM" — ausente = sem janela definida (trata como fora do horário o tempo todo). */
  janelaInicio: string | null;
  janelaFim: string | null;
  minMinutosSemResposta: number;
}

export interface EstadoConversaTrigger {
  agora: Date;
  /** `null` quando não há como determinar a última resposta humana (ex.: conversa nova). */
  minutosSemRespostaHumana: number | null;
  /** Handoff pro humano já ativo pra esta conversa (E02-S01) — trigger de desativação vence sempre. */
  handoffAtivo: boolean;
}

function estaDentroDaJanela(config: ConfigTriggerAutomatico, agora: Date): boolean {
  if (!config.dias.includes(agora.getDay())) return false;
  if (!config.janelaInicio || !config.janelaFim) return false;
  const atual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  return atual >= config.janelaInicio.slice(0, 5) && atual <= config.janelaFim.slice(0, 5);
}

/** AC-1/AC-2/AC-3/AC-4: matriz de decisão da spec (E02-S25). Handoff ativo sempre silencia,
 * independente de horário/inatividade — é o trigger de desativação, tem precedência. */
export function deveResponderAutomaticamente(
  config: ConfigTriggerAutomatico,
  estado: EstadoConversaTrigger,
): boolean {
  if (!config.ativo) return false;
  if (estado.handoffAtivo) return false;
  const dentroDaJanela = estaDentroDaJanela(config, estado.agora);
  if (!dentroDaJanela) return true;
  if (estado.minutosSemRespostaHumana === null) return false;
  return estado.minutosSemRespostaHumana >= config.minMinutosSemResposta;
}
