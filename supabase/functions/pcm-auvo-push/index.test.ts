// index.test.ts — teste da lógica de decisão por linha do drain (`processOutboxRow`), isolada do
// cliente Supabase real via o stub `OutboxRowDb`. Cobre idempotência (AC-4), writeEnabled=false
// (AC-6) e o mapeamento de `op` (create/update/delete) para o verbo Auvo certo.
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/pcm-auvo-push/index.test.ts --allow-env

import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type OutboxRow, type OutboxRowDb, processOutboxRow } from "./index.ts";
import type { AuvoEntityDescriptor } from "../_shared/auvo/registry/types.ts";

function withEnv(vars: Record<string, string>): () => void {
  const original = Deno.env.get;
  // deno-lint-ignore no-explicit-any
  (Deno.env as any).get = (key: string) => vars[key] ?? original.call(Deno.env, key);
  return () => {
    // deno-lint-ignore no-explicit-any
    (Deno.env as any).get = original;
  };
}

function withFetch(handler: (req: Request) => Response): { restore: () => void; calls: Request[] } {
  const original = globalThis.fetch;
  const calls: Request[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (req.url.includes("/login")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ result: { accessToken: "tok", expiration: new Date(Date.now() + 1_800_000).toISOString() } }),
          { status: 200 },
        ),
      );
    }
    calls.push(req.clone());
    return Promise.resolve(handler(req));
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, calls };
}

const ENV = { AUVO_API_KEY: "k", AUVO_USER_TOKEN: "t" };

function fakeDescriptor(): AuvoEntityDescriptor<Record<string, unknown>, Record<string, unknown>> {
  return {
    key: "fake",
    auvoBasePath: "/fake-resource",
    pcmTable: "fake_tabela",
    writeEnabled: true,
    toAuvo: (row) => ({ name: row.nome }),
    fromAuvo: (a) => ({ nome: a.name }),
  };
}

/** Stub de `OutboxRowDb` que serve uma linha de origem fixa e grava as chamadas de
 * `applyAuvoSync` para inspeção nos asserts. */
function fakeDb(origem: Record<string, unknown> | null): OutboxRowDb & { patches: Array<{ table: string; rowId: string; patch: Record<string, unknown> }> } {
  const patches: Array<{ table: string; rowId: string; patch: Record<string, unknown> }> = [];
  return {
    patches,
    fetchOrigem: () => Promise.resolve(origem),
    applyAuvoSync: (table, rowId, patch) => {
      patches.push({ table, rowId, patch });
      return Promise.resolve();
    },
  };
}

const baseRow: OutboxRow = { id: "outbox-1", entity: "fake", row_id: "row-1", op: "create", attempts: 0 };

Deno.test("processOutboxRow — descriptor desconhecido devolve ok:false sem lançar", async () => {
  const db = fakeDb({ id: "row-1", nome: "X" });
  const resultado = await processOutboxRow(db, baseRow, undefined);
  assertEquals(resultado.ok, false);
  assertMatch(resultado.error ?? "", /descriptor desconhecido/);
});

Deno.test("processOutboxRow — writeEnabled=false nunca chama o Auvo (AC-6)", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response("não deveria ser chamado", { status: 500 }));
  try {
    const descriptor = { ...fakeDescriptor(), writeEnabled: false };
    const db = fakeDb({ id: "row-1", nome: "X" });
    const resultado = await processOutboxRow(db, baseRow, descriptor);
    assertEquals(resultado.ok, false);
    assertMatch(resultado.error ?? "", /writeEnabled=false/);
    assertEquals(calls.length, 0);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — linha de origem ausente devolve ok:false sem lançar", async () => {
  const db = fakeDb(null);
  const resultado = await processOutboxRow(db, baseRow, fakeDescriptor());
  assertEquals(resultado.ok, false);
  assertMatch(resultado.error ?? "", /não encontrada/);
});

Deno.test("processOutboxRow — create sem auvo_id existente faz POST com externalId e grava auvo_id", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch((req) => {
    assertEquals(req.method, "POST");
    return new Response(JSON.stringify({ result: { id: 123 } }), { status: 201 });
  });
  try {
    const db = fakeDb({ id: "row-1", nome: "X" }); // sem auvo_id
    const resultado = await processOutboxRow(db, baseRow, fakeDescriptor());
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 1);
    assertEquals(db.patches.length, 1);
    assertEquals(db.patches[0].patch.auvo_id, 123);
    assertEquals(db.patches[0].patch.auvo_sync_status, "synced");
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — externalIdField customizado (ex. Services usa externalCode)", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response(JSON.stringify({ result: { id: 7 } }), { status: 201 }));
  try {
    const descriptor = { ...fakeDescriptor(), externalIdField: "externalCode" };
    const db = fakeDb({ id: "row-1", nome: "X" });
    await processOutboxRow(db, baseRow, descriptor);
    const corpo = await calls[0].json();
    assertEquals(corpo.externalCode, "row-1");
    assertEquals(corpo.externalId, undefined);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — reprocessar linha com auvo_id existente faz PATCH, nunca um novo POST (AC-4)", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch((req) => {
    assertEquals(req.method, "PATCH");
    return new Response(JSON.stringify({ result: { id: 55 } }), { status: 200 });
  });
  try {
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 55 });
    const row: OutboxRow = { ...baseRow, op: "update" };
    const resultado = await processOutboxRow(db, row, fakeDescriptor());
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 1); // só o PATCH — nenhuma chamada extra de criação
    assertEquals(db.patches[0].patch.auvo_id, 55);
    // PATCH da Auvo é JSON Patch, não objeto flat — ver _shared/auvo/json-patch.ts.
    const corpo = await calls[0].json();
    assertEquals(corpo, [{ op: "replace", path: "name", value: "X" }]);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — delete com auvo_id existente faz PATCH active:false em formato JSON Patch", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch((req) => {
    assertEquals(req.method, "PATCH");
    assertMatch(req.url, /\/fake-resource\/77$/);
    return new Response(null, { status: 204 });
  });
  try {
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 77 });
    const row: OutboxRow = { ...baseRow, op: "delete" };
    const resultado = await processOutboxRow(db, row, fakeDescriptor());
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 1);
    const corpo = await calls[0].json();
    assertEquals(corpo, [{ op: "replace", path: "active", value: false }]);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — delete de linha nunca sincronizada não chama o Auvo", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response("não deveria ser chamado", { status: 500 }));
  try {
    const db = fakeDb({ id: "row-1", nome: "X" }); // sem auvo_id
    const row: OutboxRow = { ...baseRow, op: "delete" };
    const resultado = await processOutboxRow(db, row, fakeDescriptor());
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 0);
    assertEquals(db.patches[0].patch.auvo_sync_status, "synced");
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — deleteStrategy='hard-delete' chama DELETE físico, não PATCH", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch((req) => {
    assertEquals(req.method, "DELETE");
    return new Response(null, { status: 204 });
  });
  try {
    const descriptor = { ...fakeDescriptor(), deleteStrategy: "hard-delete" as const };
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 88 });
    const row: OutboxRow = { ...baseRow, op: "delete" };
    const resultado = await processOutboxRow(db, row, descriptor);
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 1);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — deactivatePatch customizado é usado em vez de active:false", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response(null, { status: 204 }));
  try {
    const descriptor = { ...fakeDescriptor(), deactivatePatch: { unavailableForTasks: true } };
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 99 });
    const row: OutboxRow = { ...baseRow, op: "delete" };
    await processOutboxRow(db, row, descriptor);
    const corpo = await calls[0].json();
    assertEquals(corpo, [{ op: "replace", path: "unavailableForTasks", value: true }]);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — deleteStrategy='unsupported' não chama o Auvo (ex. Teams sem DELETE)", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response("não deveria ser chamado", { status: 500 }));
  try {
    const descriptor = { ...fakeDescriptor(), deleteStrategy: "unsupported" as const };
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 44 });
    const row: OutboxRow = { ...baseRow, op: "delete" };
    const resultado = await processOutboxRow(db, row, descriptor);
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 0);
  } finally {
    restore();
    restoreEnv();
  }
});

Deno.test("processOutboxRow — supportsUpdate=false trata op='update' como no-op de sucesso", async () => {
  const restoreEnv = withEnv(ENV);
  const { restore, calls } = withFetch(() => new Response("não deveria ser chamado", { status: 500 }));
  try {
    const descriptor = { ...fakeDescriptor(), supportsUpdate: false };
    const db = fakeDb({ id: "row-1", nome: "X", auvo_id: 10 });
    const row: OutboxRow = { ...baseRow, op: "update" };
    const resultado = await processOutboxRow(db, row, descriptor);
    assertEquals(resultado.ok, true);
    assertEquals(calls.length, 0);
  } finally {
    restore();
    restoreEnv();
  }
});
