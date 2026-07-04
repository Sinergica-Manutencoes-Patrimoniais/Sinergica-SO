// Domínio puro — regras da Visão 360 do Cliente (E01-S12). Sem I/O, sem framework
// (ver docs/ARCHITECTURE.md — domain/).
//
// Responsabilidade única: a fronteira "backlog em aberto" × "histórico". As duas funções abaixo
// são complementares por construção (ehStatusEmAberto === !ehStatusHistorico), garantindo que
// NENHUMA OS suma entre os painéis (spec AC-3/AC-4 + AUTO-DECISION #1: `em_execucao` conta como
// "em aberto"). É a fonte única da regra — o adapter Supabase reusa STATUS_HISTORICO para montar
// os filtros de query, em vez de repetir a lista de strings.

/** Status que jogam a OS no painel Histórico (concluída ou cancelada) — ciclo E01-S09/S10. */
export const STATUS_HISTORICO = ["finalizado", "cancelado"] as const;

/**
 * A OS pertence ao Histórico? `status IN ('finalizado','cancelado')` (AC-4).
 * Complemento exato de {@link ehStatusEmAberto}.
 */
export function ehStatusHistorico(status: string): boolean {
  return (STATUS_HISTORICO as readonly string[]).includes(status);
}

/**
 * A OS está em aberto/andamento? Todo status que NÃO é histórico — inclui `solicitacao`,
 * `planejamento` e `em_execucao` (AC-3, AUTO-DECISION #1). Complemento exato de
 * {@link ehStatusHistorico}: juntas cobrem todo status sem sobreposição nem buraco.
 */
export function ehStatusEmAberto(status: string): boolean {
  return !ehStatusHistorico(status);
}

/**
 * Rótulo de exibição de um campo de cadastro possivelmente nulo/vazio (AC-2).
 * Devolve `textoVazio` quando o valor é `null`/`undefined`/string em branco; senão a representação
 * textual do valor. Nunca lança — cadastro incompleto não pode quebrar o cabeçalho.
 */
export function rotuloOuPlaceholder(
  valor: string | number | null | undefined,
  textoVazio: string,
): string {
  if (valor === null || valor === undefined) return textoVazio;
  const texto = String(valor).trim();
  return texto === "" ? textoVazio : texto;
}
