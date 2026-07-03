// _shared/auvo/priority-map.ts — mapa `prioridade` (PCM) → `priority` (Auvo, 3 níveis).
//
// SPEC_DEVIATION (provisório, ver design.md → Questões em aberto): design.md marca este
// mapeamento como decisão de PRODUTO ainda não confirmada por Fabrício ("proposta: critica→3,
// alta→3, media→2, baixa→1, mas Fabrício decide"). AC-4 exige que `priority` seja enviado em
// toda criação de task — sem a confirmação, implementamos a proposta do próprio design.md
// literalmente, com fallback defensivo (nunca lança erro por prioridade desconhecida/coluna
// ainda não populada — `pcm.ordens_servico.prioridade` hoje tem default `'normal'`, fora do
// vocabulário GUT `critica/alta/media/baixa` documentado em `docs/glossary.md`). Reavaliar assim
// que Fabrício confirmar — atualizar este arquivo + remover esta nota quando resolvido.

const AUVO_PRIORITY_MAP: Readonly<Record<string, number>> = Object.freeze({
  critica: 3,
  alta: 3,
  media: 2,
  baixa: 1,
});

/** Prioridade Auvo default quando `prioridade` da OS não bate com o vocabulário GUT conhecido
 * (ex.: coluna ainda no default `'normal'`) — nível médio, nunca lança erro. */
const DEFAULT_AUVO_PRIORITY = 2;

export function resolveAuvoPriority(prioridade: string): number {
  return AUVO_PRIORITY_MAP[prioridade] ?? DEFAULT_AUVO_PRIORITY;
}
