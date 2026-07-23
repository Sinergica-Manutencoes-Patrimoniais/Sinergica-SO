// domain/historico-chamado.ts — E01-S89. Snapshot imutável de X dias de conversa anexado a um
// Chamado (pcm.chamados, E01-S88) — cross-domínio: este arquivo não importa nada de
// `features/pcm/`, só descreve o formato do snapshot em si (a mensagem já resolvida, texto puro).

export interface MensagemSnapshot {
  id: string;
  remetenteTipo: string;
  conteudo: string | null;
  tipoConteudo: string;
  /** Path bruto do bucket privado (`atendimento-midias`), nunca signed URL — expiraria. */
  midiaUrl: string | null;
  createdAt: string;
}

export interface HistoricoChamadoSnapshot {
  id: string;
  conversaId: string;
  chamadoId: string;
  janelaDias: number;
  dataInicio: string;
  dataFim: string;
  mensagens: MensagemSnapshot[];
  totalMensagens: number;
  createdAt: string;
}

export const JANELAS_DIAS_PADRAO = [1, 3, 7, 15, 30];

/** AC-1: calcula a janela [dataInicio, dataFim] a partir de "X dias atrás até agora". */
export function calcularJanela(
  diasAtras: number,
  agora: Date = new Date(),
): { dataInicio: string; dataFim: string } {
  if (!Number.isInteger(diasAtras) || diasAtras <= 0) {
    throw new Error("Janela deve ser de pelo menos 1 dia.");
  }
  const dataFim = agora.toISOString();
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - diasAtras);
  return { dataInicio: inicio.toISOString(), dataFim };
}

/** Caso de borda (spec.md "Casos de borda e erros"): janela sem mensagens não gera registro
 * vazio — avisa em vez de criar um snapshot inútil. */
export function validarMensagensParaSnapshot(mensagens: unknown[]): void {
  if (mensagens.length === 0) {
    throw new Error("Nenhuma mensagem encontrada nessa janela — nada para anexar.");
  }
}
