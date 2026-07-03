// _shared/auvo/task-type-map.ts — mapa categoria (PCM) → taskTypeId (Auvo).
// IDs confirmados na conta Auvo de produção para corretiva/preventiva/inspecao (ver
// docs/blueprint/integracoes/auvo.md e specs/E01-S09-integracao-auvo-fundacao/design.md).
// `levantamento`/`emergencial` ficam PROPOSITALMENTE fora do mapa — lookup miss, não crash
// (AC-7 da spec: falha explícita, sem tentar criar task com taskTypeId inválido).

export const AUVO_TASK_TYPE_MAP: Readonly<Record<string, number>> = Object.freeze({
  corretiva: 228714,
  preventiva: 139989,
  inspecao: 179776,
  // levantamento, emergencial: sem taskTypeId confirmado — ver design.md → Questões em aberto.
});

/** Resolve o `taskTypeId` Auvo para uma `categoria` de OS. `undefined` = sem mapeamento (AC-7). */
export function resolveAuvoTaskTypeId(categoria: string): number | undefined {
  return AUVO_TASK_TYPE_MAP[categoria];
}
