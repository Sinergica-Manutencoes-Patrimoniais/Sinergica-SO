import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveWebhookDispatch } from "./webhook-dispatch.ts";
import type { AuvoEntityDescriptor } from "./registry/types.ts";

type Row = Record<string, unknown> & {
  auvo_id?: number;
  nome?: string;
  ativo?: boolean;
  deleted_at?: string;
  auvo_sync_status?: string;
  auvo_sync_error?: string | null;
  auvo_synced_at?: string;
};

const descriptor: AuvoEntityDescriptor<{ id: number; name?: string }, Row> = {
  key: "clientes",
  auvoBasePath: "/customers",
  pcmTable: "clientes",
  webhookEntity: 7,
  writeEnabled: true,
  toAuvo: (row) => ({ id: row.auvo_id ?? 0, name: row.nome }),
  fromAuvo: (auvo) => ({ nome: auvo.name }),
};

Deno.test("resolveWebhookDispatch — Inclusao/Alteracao vira upsert por auvo_id", () => {
  const decision = resolveWebhookDispatch({ entity: 7, action: 2, payload: { id: 123, name: "ACME" } }, descriptor);
  assertEquals(decision.action, "upsert");
  if (decision.action !== "upsert") throw new Error("expected upsert");
  assertEquals(decision.auvoId, 123);
  assertEquals(decision.patch.nome, "ACME");
  assertEquals(decision.patch.auvo_id, 123);
  assertEquals(decision.patch.auvo_sync_status, "synced");
  assertExists(decision.patch.auvo_synced_at);
});

Deno.test("resolveWebhookDispatch — Exclusao vira soft-delete local", () => {
  const decision = resolveWebhookDispatch({ entity: 7, action: 3, id: "123" }, descriptor);
  assertEquals(decision.action, "soft-delete");
  if (decision.action !== "soft-delete") throw new Error("expected soft-delete");
  assertEquals(decision.auvoId, 123);
  assertEquals(decision.patch.auvo_id, 123);
  assertEquals(decision.patch.ativo, false);
  assertExists(decision.patch.deleted_at);
});

Deno.test("resolveWebhookDispatch — descriptor ausente ou desligado ignora com motivo claro", () => {
  assertEquals(resolveWebhookDispatch({ action: 2, id: 1 }, undefined), {
    action: "ignore",
    reason: "descriptor_not_found",
  });
  assertEquals(resolveWebhookDispatch({ action: 2, id: 1 }, { ...descriptor, writeEnabled: false }), {
    action: "ignore",
    reason: "write_disabled",
  });
});
