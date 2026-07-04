// _shared/auvo/paginate.ts — helper de paginação genérico para os endpoints de listagem do Auvo v2
// (`GET /users`, `GET /equipments`), reaproveitado pelas Edge Functions de sync `pcm-auvo-users-
// sync`/`pcm-auvo-equipment-sync` (E01-S11). Ver spec.md → "Casos de borda" (o sync precisa iterar
// TODAS as páginas, não só a primeira).
//
// Contrato: `fetchPage(pageNumber, pageSize)` devolve os itens daquela página. O acumulador para
// quando uma página vem com MENOS itens que `pageSize` (última página parcial) ou vazia. Se
// `fetchPage` lançar (rede, 5xx do Auvo), o erro PROPAGA para o chamador — nunca devolve um
// acumulado parcial silencioso: quem chama decide o que fazer (nas Edge Functions, abortar sem
// tocar em `ativo`, para não marcar como inativo um registro que só não foi alcançado por erro —
// guarda de soft-delete, AC-4/task 6).
//
// Genérico de propósito: não conhece o shape da resposta do Auvo (`result`, `paramFilter`, nomes
// de campo) — isso fica nas Edge Functions. Aqui só a mecânica de iterar páginas.

/** Tamanho de página padrão — alto (100) para minimizar chamadas e ficar longe do rate limit de
 *  400 req/min do Auvo (spec.md → Casos de borda). */
export const DEFAULT_PAGE_SIZE = 100;

/** Trava de segurança contra loop infinito caso o Auvo devolva sempre uma página cheia (dado
 *  patológico ou bug de paginação do lado deles). 100k registros por sync é folga larga para a
 *  Sinérgica; se estourar, é sinal de problema — melhor lançar que iterar sem fim. */
const MAX_PAGES = 1_000;

export interface PaginateOptions {
  pageSize?: number;
}

/**
 * Itera todas as páginas via `fetchPage`, começando em `pageNumber = 1`, e devolve todos os itens
 * concatenados. Para na primeira página com menos que `pageSize` itens (inclusive vazia).
 *
 * @throws o que `fetchPage` lançar (propagado sem tratamento) — e RangeError se passar de MAX_PAGES.
 */
export async function auvoPaginate<T>(
  fetchPage: (pageNumber: number, pageSize: number) => Promise<T[]>,
  opts: PaginateOptions = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const acc: T[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const page = await fetchPage(pageNumber, pageSize); // pode lançar — propaga
    acc.push(...page);
    if (page.length < pageSize) return acc; // última página (parcial ou vazia)
  }

  throw new RangeError(
    `auvoPaginate: excedeu MAX_PAGES (${MAX_PAGES}) — Auvo devolvendo páginas cheias sem fim?`,
  );
}
