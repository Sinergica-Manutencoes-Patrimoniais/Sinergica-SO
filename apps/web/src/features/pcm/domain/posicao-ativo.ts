// domain/posicao-ativo.ts — E01-S155: Componente e Sistema podem ficar em qualquer nível
// (Cliente, Área ou Local). Sem backfill nas linhas legadas (design.md, "Regra de ouro") — quem
// tem `local_id` mas não `area_id` (dado anterior a esta story) precisa da Área **efetiva**.

export interface AtivoPosicionavel {
  areaId: string | null;
  localId: string | null;
}

/** Área efetiva = `areaId` se presente, senão a Área do Local (quando o Local existir no mapa
 * passado). `null` quando o ativo não tem Área nem Local, ou o Local não foi encontrado. */
export function areaEfetiva(
  ativo: AtivoPosicionavel,
  locaisPorId: ReadonlyMap<string, { areaId: string }>,
): string | null {
  if (ativo.areaId) return ativo.areaId;
  if (!ativo.localId) return null;
  return locaisPorId.get(ativo.localId)?.areaId ?? null;
}
