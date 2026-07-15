// _shared/auvo/datetime.ts — E01-S68. O Auvo devolve datetime SEM offset (ex.: "2026-07-13T08:00:00")
// que é horário de Brasília (GMT-3), não UTC. Gravar essa string verbatim numa coluna `timestamptz`
// (ou fazer `new Date(naive).toISOString()` num runtime com TZ=UTC, como as Edge Functions) faz o
// Postgres/JS interpretar como UTC — erro de 3h pra menos no horário real (grava 3h ADIANTADO do
// que deveria). Confirmado em produção 2026-07-14: taskDate "08:00:00" (Brasília) virou "08:00Z"
// em vez de "11:00Z". Brasília não tem horário de verão desde 2019 — offset fixo -03:00, seguro
// hardcodear sem depender de biblioteca de timezone.

/**
 * Trata uma string de data/hora do Auvo como horário de Brasília quando ela não já tem offset
 * (`Z` ou `±HH:MM`), devolvendo a representação UTC correta. Strings já com offset, vazias ou
 * nulas passam direto (ou viram `null`) — nunca desloca duas vezes.
 */
export function auvoNaiveToUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Já tem offset (Z ou +HH:MM/-HH:MM ao final) — não é naive, não mexe.
  if (/[Zz]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const data = new Date(trimmed);
    return Number.isNaN(data.getTime()) ? null : data.toISOString();
  }

  // Naive — assume Brasília (-03:00) explicitamente, sem depender do TZ do runtime.
  const comOffset = `${trimmed}-03:00`;
  const data = new Date(comOffset);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}
