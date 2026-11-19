// E01-S199 — "Campo a conciliar": a fila de ENTRADA do Kanban para OS que chegaram do Auvo sem
// ID de Chamado (BL 007 AC-5 do Pacote Consolidado do Fabrício).
//
// Domínio puro: nada aqui toca rede, Supabase ou React. O motivo vem do banco como um código
// estável (`pcm.sso_origem_campo_processamentos.motivo`, migration 1420) — traduzi-lo é decisão
// de apresentação, e por isso mora aqui e não numa string solta no componente.

export interface ItemCampoAConciliar {
  readonly osId: string;
  readonly chamadoId: string;
  readonly osNumero: string;
  readonly chamadoNumero: string;
  readonly titulo: string;
  readonly motivo: string;
  readonly taskId: number | null;
  readonly statusOs: string;
  readonly criadoEm: string;
}

/** Códigos gravados por `pcm.sso_processar_tarefa_campo_atomica` (1420) quando cria o par
 * provisório. Códigos fora deste mapa caem no rótulo genérico — nunca somem da tela. */
export const MOTIVO_CAMPO_LABEL: Record<string, string> = {
  referencia_ausente: "Sem referência de Chamado",
  referencia_invalida_ou_outro_cliente: "Referência inválida ou de outro Cliente",
  referencia_chamado: "Referência de Chamado a confirmar",
};

export function rotuloMotivoCampo(motivo: string): string {
  return MOTIVO_CAMPO_LABEL[motivo] ?? "Sem referência de Chamado";
}
