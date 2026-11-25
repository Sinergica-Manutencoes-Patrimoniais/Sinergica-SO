// trigger-automatico.ts — E02-S25. Decide se o Zé deve responder automaticamente (sem ser
// mencionado): fora do horário humano configurado, OU após X minutos sem resposta humana dentro
// dele. Pura, sem I/O — testável sem LLM/banco. Modelo unilateral (reunião 2026-07-27): um
// trigger ativa (esta função), outro desativa (handoff pro humano, já existente em
// `deveTransferirParaHumano`).

/** Fuso em que "08:00" significa oito da manhã para quem atende. A Edge Function roda em UTC: sem
 * isto, "08:00–18:00" valeria das 5h às 15h de Brasília e o Zé assumiria a tarde inteira. */
export const FUSO_OPERACAO = "America/Sao_Paulo";

/** AC-6: cada dia da semana pode ter a SUA janela (seg–sex 08–18, sáb 08–12, dom nenhuma). */
export interface JanelaDoDia {
  /** 0=dom .. 6=sáb. */
  dia: number;
  /** "HH:MM". */
  inicio: string;
  fim: string;
}

export interface ConfigTriggerAutomatico {
  ativo: boolean;
  /** Dias da semana (0=dom..6=sáb) em que humanos respondem. Vazio = nenhum dia (Zé sempre assume).
   * Formato legado de 0158 — usado só quando `janelas` está vazio. */
  dias: number[];
  /** "HH:MM" — ausente = sem janela definida (trata como fora do horário o tempo todo). Legado. */
  janelaInicio: string | null;
  janelaFim: string | null;
  minMinutosSemResposta: number;
  /** AC-6: janelas por dia da semana (migration 1881). Quando há pelo menos uma, ela MANDA e o
   * par `dias`/`janelaInicio/Fim` é ignorado — é o formato novo, o outro é o que já estava em
   * produção e não pode parar de funcionar de um deploy pro outro. */
  janelas?: JanelaDoDia[];
}

export interface EstadoConversaTrigger {
  agora: Date;
  /** `null` quando não há como determinar a última resposta humana (ex.: conversa nova). */
  minutosSemRespostaHumana: number | null;
  /** Handoff pro humano já ativo pra esta conversa (E02-S01) — trigger de desativação vence sempre. */
  handoffAtivo: boolean;
}

/** Dia da semana e "HH:MM" civis no fuso de operação, não no fuso do processo. */
function momentoCivil(agora: Date, fuso = FUSO_OPERACAO): { dia: number; hhmm: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // `hour: "2-digit"` com hour12:false devolve "24" na virada em alguns runtimes — normaliza.
  const hora = valor("hour") === "24" ? "00" : valor("hour");
  return { dia: dias[valor("weekday")] ?? 0, hhmm: `${hora}:${valor("minute")}` };
}

function janelasDoDia(config: ConfigTriggerAutomatico, dia: number): JanelaDoDia[] {
  if (config.janelas && config.janelas.length > 0) {
    return config.janelas.filter((j) => j.dia === dia);
  }
  if (!config.dias.includes(dia)) return [];
  if (!config.janelaInicio || !config.janelaFim) return [];
  return [{ dia, inicio: config.janelaInicio, fim: config.janelaFim }];
}

function estaDentroDaJanela(config: ConfigTriggerAutomatico, agora: Date): boolean {
  const { dia, hhmm } = momentoCivil(agora);
  return janelasDoDia(config, dia).some(
    (janela) => hhmm >= janela.inicio.slice(0, 5) && hhmm <= janela.fim.slice(0, 5),
  );
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

/** AC-2: quantos minutos faltam até o Zé poder assumir por inatividade humana. `null` = não há o
 * que esperar (ou ele já pode responder, ou nunca vai responder por este caminho).
 *
 * Sem isto o AC-2 não acontece de verdade: a mensagem do cliente chega, o humano não responde, e
 * ninguém mais olha aquela conversa — nada "acorda" aos X minutos. Com isto, o item da fila é
 * reagendado para o instante exato em que a espera vence (porte do `despacho_ritmo` do
 * TriviAtende, onde a espera também vive numa linha durável com prazo, e não num timer em
 * memória). */
export function minutosAteAssumirPorInatividade(
  config: ConfigTriggerAutomatico,
  estado: EstadoConversaTrigger,
): number | null {
  if (!config.ativo || estado.handoffAtivo) return null;
  if (!estaDentroDaJanela(config, estado.agora)) return null;
  if (estado.minutosSemRespostaHumana === null) return null;
  const falta = config.minMinutosSemResposta - estado.minutosSemRespostaHumana;
  return falta > 0 ? falta : null;
}

/** Porte do `faltaParaAtivar` do TriviAtende (`modules/agente/domain/configuracao.ts`): devolve o
 * que falta, não um booleano. "Não dá para ativar" sem dizer o quê é o jeito mais rápido de a
 * pessoa desistir — e, no nosso caso, de alguém achar que ligou o trigger e ele estar mudo. */
export function faltaParaAtivarTriggerAutomatico(config: ConfigTriggerAutomatico): string[] {
  const falta: string[] = [];
  const temJanela =
    (config.janelas && config.janelas.length > 0) ||
    (config.dias.length > 0 && Boolean(config.janelaInicio) && Boolean(config.janelaFim));
  if (!temJanela) {
    falta.push("Horário de atendimento humano em pelo menos um dia da semana");
  }
  if (!Number.isFinite(config.minMinutosSemResposta) || config.minMinutosSemResposta <= 0) {
    falta.push("Minutos sem resposta humana até o Zé assumir (maior que zero)");
  }
  for (const janela of config.janelas ?? []) {
    if (janela.fim.slice(0, 5) <= janela.inicio.slice(0, 5)) {
      falta.push(`Fim depois do início no dia ${janela.dia}`);
    }
  }
  return falta;
}
