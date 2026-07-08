// Testes de `runSyncAll` contra um `Caller` stub — sem fetch real, sem env vars. Cobre AC-1/AC-3
// de specs/E01-S37-botao-sincronizar-auvo/spec.md.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type Caller, runSyncAll } from "./index.ts";

Deno.test("runSyncAll — chama pull para cada entidade + tasks-import, tudo ok", async () => {
  const chamadas: Array<{ path: string; body?: unknown }> = [];
  const caller: Caller = (path, body) => {
    chamadas.push({ path, body });
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll(["funcionarios", "clientes"], caller);

  assertEquals(resultado.ok, true);
  assertEquals(resultado.results.length, 3); // 2 pulls + 1 tasks-import
  assertEquals(chamadas, [
    { path: "pcm-auvo-pull", body: { entity: "funcionarios" } },
    { path: "pcm-auvo-pull", body: { entity: "clientes" } },
    { path: "pcm-auvo-tasks-import", body: undefined },
  ]);
});

Deno.test("runSyncAll — falha de UMA entidade não aborta as demais (AC-3)", async () => {
  const caller: Caller = (path, body) => {
    const entity = (body as { entity?: string } | undefined)?.entity;
    if (entity === "clientes") return Promise.reject(new Error("Auvo 500: erro simulado"));
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll(["funcionarios", "clientes", "servicos"], caller);

  assertEquals(resultado.ok, false); // agregado reflete a falha
  assertEquals(resultado.results.length, 4); // 3 pulls + 1 tasks-import, nenhum pulado
  const falhaClientes = resultado.results.find((r) => r.step === "pull:clientes");
  assertEquals(falhaClientes?.ok, false);
  assertEquals(falhaClientes?.error, "Auvo 500: erro simulado");
  const okFuncionarios = resultado.results.find((r) => r.step === "pull:funcionarios");
  assertEquals(okFuncionarios?.ok, true);
  const okServicos = resultado.results.find((r) => r.step === "pull:servicos");
  assertEquals(okServicos?.ok, true);
  const okTasksImport = resultado.results.find((r) => r.step === "tasks-import");
  assertEquals(okTasksImport?.ok, true);
});

Deno.test("runSyncAll — lista de entidades vazia só roda tasks-import", async () => {
  const chamadas: string[] = [];
  const caller: Caller = (path) => {
    chamadas.push(path);
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll([], caller);

  assertEquals(resultado.ok, true);
  assertEquals(chamadas, ["pcm-auvo-tasks-import"]);
});
