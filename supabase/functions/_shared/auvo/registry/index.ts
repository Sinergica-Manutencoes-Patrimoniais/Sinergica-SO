// registry/index.ts — agregador do entity registry (E01-S22). Vazio nesta story: cada entidade
// concreta (Tipos de Tarefa, Segmentos, Funcionários, ...) registra seu próprio descriptor aqui
// quando sua story (`E01-S24`+) for implementada. `pcm-auvo-push` e o futuro dispatcher/poller de
// `E01-S23` só conhecem este módulo — nunca importam um descriptor de entidade diretamente.

import type { AuvoEntityDescriptor, AuvoEntityRegistry } from "./types.ts";

const registry: AuvoEntityRegistry = {
  // Entidades concretas entram aqui a partir de E01-S24, ex.:
  // tiposTarefa: tiposTarefaDescriptor,
};

/** Resolve o descriptor de uma entidade pela chave gravada em `pcm.auvo_sync_outbox.entity`.
 * Nunca lança — chave desconhecida devolve `undefined`, e quem chama decide (drain marca a linha
 * do outbox como erro em vez de derrubar o lote inteiro). */
export function getDescriptor(entity: string): AuvoEntityDescriptor<unknown, unknown> | undefined {
  return registry[entity];
}

/** Lista as chaves registradas — útil para o poller genérico de `E01-S23` iterar todo descriptor
 * com `cronSchedule` definido. */
export function listEntities(): string[] {
  return Object.keys(registry);
}
