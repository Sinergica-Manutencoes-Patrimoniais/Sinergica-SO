// registry/index.test.ts — teste unitário do agregador do entity registry (E01-S22).
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/registry/index.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __setRegistryForTest, byWebhookEntity, cronEnabled, getDescriptor, listEntities } from "./index.ts";
import { clienteGruposDescriptor } from "./cliente-grupos.ts";
import { clientesDescriptor } from "./clientes.ts";
import { palavrasChaveDescriptor, segmentosDescriptor } from "./catalogos-simples.ts";
import { equipamentoCategoriasDescriptor, produtoCategoriasDescriptor } from "./categorias.ts";
import { equipamentosDescriptor } from "./equipamentos.ts";
import { equipesDescriptor } from "./equipes.ts";
import { ferramentasDescriptor } from "./ferramentas.ts";
import { funcionariosDescriptor } from "./funcionarios.ts";
import { servicosDescriptor } from "./servicos.ts";
import { tiposTarefaDescriptor } from "./tipos-tarefa.ts";
import type { AuvoEntityDescriptor } from "./types.ts";

const descriptor: AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>> = {
  key: "clientes",
  auvoBasePath: "/customers",
  pcmTable: "clientes",
  webhookEntity: 7,
  cronSchedule: "0 6 * * *",
  writeEnabled: true,
  toAuvo: (row) => row,
  fromAuvo: (auvo) => auvo,
};

function resetRegistry(): void {
  __setRegistryForTest({
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
    tipos_tarefa: tiposTarefaDescriptor,
  });
}

Deno.test("getDescriptor — chave desconhecida devolve undefined, nunca lança", () => {
  resetRegistry();
  assertEquals(getDescriptor("entidade-que-nao-existe"), undefined);
});

Deno.test("listEntities — inclui descriptors concretos registrados", () => {
  resetRegistry();
  assertEquals(listEntities(), [
    "cliente_grupos",
    "clientes",
    "equipamento_categorias",
    "equipamentos",
    "equipes",
    "ferramentas",
    "funcionarios",
    "palavras_chave",
    "produto_categorias",
    "servicos",
    "segmentos",
    "tipos_tarefa",
  ]);
});

Deno.test("byWebhookEntity — resolve pelo entity numérico do Auvo", () => {
  __setRegistryForTest({ clientes: descriptor });
  assertEquals(byWebhookEntity(7)?.key, "clientes");
  assertEquals(byWebhookEntity(62), undefined);
  resetRegistry();
});

Deno.test("cronEnabled — lista só descriptors com cronSchedule", () => {
  __setRegistryForTest({
    clientes: descriptor,
    tickets: { ...descriptor, key: "tickets", pcmTable: "tickets", webhookEntity: 62, cronSchedule: undefined },
  });
  assertEquals(cronEnabled().map((item) => item.key), ["clientes"]);
  resetRegistry();
});
