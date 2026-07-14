// index.test.ts — testes unitários das funções puras de pcm-auvo-webhooks-register (E01-S68).
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/pcm-auvo-webhooks-register/index.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  descriptorsParaRegistrar,
  encontrarWebhooksStale,
  type ExistingWebhook,
  normalizeUrl,
} from "./index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";

const TARGET_URL = "https://nudannsrfvjggoergvyn.supabase.co/functions/v1/pcm-auvo-webhook";
const URL_ANTIGA = "https://sfprfvltbtysvtsqutla.supabase.co/functions/v1/pcm-auvo-webhook";

function descriptorFixture(
  overrides: Partial<AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>>>,
): AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>> {
  return {
    key: "clientes",
    auvoBasePath: "/customers",
    pcmTable: "clientes",
    webhookEntity: 7,
    writeEnabled: true,
    toAuvo: (row) => row,
    fromAuvo: (auvo) => auvo,
    ...overrides,
  };
}

Deno.test("normalizeUrl — remove barra final e espaços", () => {
  assertEquals(normalizeUrl(`${TARGET_URL}/`), TARGET_URL);
  assertEquals(normalizeUrl(`  ${TARGET_URL}  `), TARGET_URL);
  assertEquals(normalizeUrl(undefined), "");
});

Deno.test("encontrarWebhooksStale — acha os 6 webhooks reais achados em produção (URL antiga)", () => {
  const existentes: ExistingWebhook[] = [
    { id: 4601, entity: "Customer", action: "Inclusao", urlResponse: URL_ANTIGA, active: true },
    { id: 4602, entity: "Customer", action: "Alteracao", urlResponse: URL_ANTIGA, active: true },
    { id: 4603, entity: "Task", action: "Inclusao", urlResponse: URL_ANTIGA, active: true },
    { id: 4604, entity: "Task", action: "Alteracao", urlResponse: URL_ANTIGA, active: true },
    { id: 4605, entity: "27", action: "Inclusao", urlResponse: URL_ANTIGA, active: true },
    { id: 4606, entity: "27", action: "Alteracao", urlResponse: URL_ANTIGA, active: true },
  ];
  const stale = encontrarWebhooksStale(existentes, TARGET_URL);
  assertEquals(stale.length, 6);
});

Deno.test("encontrarWebhooksStale — webhook já com a URL certa não entra na lista", () => {
  const existentes: ExistingWebhook[] = [
    { id: 1, entity: "Customer", action: "Inclusao", urlResponse: TARGET_URL, active: true },
    { id: 2, entity: "Task", action: "Inclusao", urlResponse: URL_ANTIGA, active: true },
  ];
  const stale = encontrarWebhooksStale(existentes, TARGET_URL);
  assertEquals(stale.map((w) => w.id), [2]);
});

Deno.test("encontrarWebhooksStale — ignora entrada sem id (nada pra deletar)", () => {
  const existentes: ExistingWebhook[] = [{ entity: "Customer", urlResponse: URL_ANTIGA }];
  assertEquals(encontrarWebhooksStale(existentes, TARGET_URL), []);
});

Deno.test("descriptorsParaRegistrar — descriptor sem webhook nenhum precisa registrar", () => {
  const descriptors = [descriptorFixture({ key: "clientes", webhookEntity: 7 })];
  const resultado = descriptorsParaRegistrar(descriptors, [], TARGET_URL);
  assertEquals(resultado.map((d) => d.key), ["clientes"]);
});

Deno.test("descriptorsParaRegistrar — casa pelo código numérico como string", () => {
  const descriptors = [descriptorFixture({ key: "equipamentos", webhookEntity: 27 })];
  const existentes: ExistingWebhook[] = [{ id: 1, entity: "27", urlResponse: TARGET_URL }];
  assertEquals(descriptorsParaRegistrar(descriptors, existentes, TARGET_URL), []);
});

Deno.test("descriptorsParaRegistrar — casa pelo nome amigável do Auvo (ex.: Customer)", () => {
  const descriptors = [descriptorFixture({ key: "clientes", webhookEntity: 7 })];
  const existentes: ExistingWebhook[] = [{ id: 1, entity: "Customer", urlResponse: TARGET_URL }];
  assertEquals(descriptorsParaRegistrar(descriptors, existentes, TARGET_URL), []);
});

Deno.test("descriptorsParaRegistrar — webhook existe mas com URL antiga ainda precisa registrar", () => {
  const descriptors = [descriptorFixture({ key: "clientes", webhookEntity: 7 })];
  const existentes: ExistingWebhook[] = [{ id: 1, entity: "Customer", urlResponse: URL_ANTIGA }];
  const resultado = descriptorsParaRegistrar(descriptors, existentes, TARGET_URL);
  assertEquals(resultado.map((d) => d.key), ["clientes"]);
});

Deno.test("descriptorsParaRegistrar — descriptor sem webhookEntity nunca entra na lista", () => {
  const descriptors = [descriptorFixture({ key: "sem-webhook", webhookEntity: undefined })];
  assertEquals(descriptorsParaRegistrar(descriptors, [], TARGET_URL), []);
});

Deno.test("descriptorsParaRegistrar — múltiplos descriptors, só o pendente entra", () => {
  const descriptors = [
    descriptorFixture({ key: "clientes", webhookEntity: 7 }),
    descriptorFixture({ key: "funcionarios", webhookEntity: 1 }),
    descriptorFixture({ key: "tickets", webhookEntity: 62 }),
  ];
  const existentes: ExistingWebhook[] = [
    { id: 1, entity: "Customer", urlResponse: TARGET_URL },
  ];
  const resultado = descriptorsParaRegistrar(descriptors, existentes, TARGET_URL);
  assertEquals(resultado.map((d) => d.key).sort(), ["funcionarios", "tickets"]);
});
