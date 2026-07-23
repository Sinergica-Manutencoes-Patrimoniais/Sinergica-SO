// registry/index.ts — agregador do entity registry (E01-S22). Vazio nesta story: cada entidade
// concreta (Tipos de Tarefa, Segmentos, Funcionários, ...) registra seu próprio descriptor aqui
// quando sua story (`E01-S24`+) for implementada. `pcm-auvo-push` e o futuro dispatcher/poller de
// `E01-S23` só conhecem este módulo — nunca importam um descriptor de entidade diretamente.

import type { AuvoEntityDescriptor, AuvoEntityRegistry } from "./types.ts";
import { clienteGruposDescriptor } from "./cliente-grupos.ts";
import { clientesDescriptor } from "./clientes.ts";
import { palavrasChaveDescriptor, segmentosDescriptor } from "./catalogos-simples.ts";
import { equipamentoCategoriasDescriptor, produtoCategoriasDescriptor } from "./categorias.ts";
import { equipamentosDescriptor } from "./equipamentos.ts";
import { equipesDescriptor } from "./equipes.ts";
import { ferramentasDescriptor } from "./ferramentas.ts";
import { funcionariosDescriptor } from "./funcionarios.ts";
import { servicosDescriptor } from "./servicos.ts";
import { sistemasDescriptor } from "./sistemas.ts";
import { ticketsDescriptor } from "./tickets.ts";
import { tiposTarefaDescriptor } from "./tipos-tarefa.ts";

let registry: AuvoEntityRegistry = {
  cliente_grupos: clienteGruposDescriptor,
  clientes: clientesDescriptor,
  equipamento_categorias: equipamentoCategoriasDescriptor,
  equipamentos: equipamentosDescriptor,
  equipes: equipesDescriptor,
  ferramentas: ferramentasDescriptor,
  funcionarios: funcionariosDescriptor,
  palavras_chave: palavrasChaveDescriptor,
  produto_categorias: produtoCategoriasDescriptor,
  servicos: servicosDescriptor,
  segmentos: segmentosDescriptor,
  sistemas: sistemasDescriptor,
  tickets: ticketsDescriptor,
  tipos_tarefa: tiposTarefaDescriptor,
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

/** Resolve um descriptor pela entidade numérica recebida em webhook Auvo.
 * Nunca lança — evento sem descriptor é ignorado com 200 pelo dispatcher de E01-S23, para evitar
 * reentrega infinita do Auvo. */
export function byWebhookEntity(entity: number): AuvoEntityDescriptor<unknown, unknown> | undefined {
  return Object.values(registry).find((descriptor) => descriptor.webhookEntity === entity);
}

/** Lista descriptors com polling habilitado. O cron de E01-S23 invoca `pcm-auvo-pull` por
 * entidade, usando a chave do descriptor; a função genérica também aceita invocação manual. */
export function cronEnabled(): AuvoEntityDescriptor<unknown, unknown>[] {
  return Object.values(registry).filter((descriptor) => descriptor.cronSchedule != null);
}

/** Apenas para testes Deno do agregador enquanto as entidades concretas ainda não existem. */
export function __setRegistryForTest(nextRegistry: AuvoEntityRegistry): void {
  registry = nextRegistry;
}
