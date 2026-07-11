// Testes de `runSyncAll` contra um `Caller` stub — sem fetch real, sem env vars. Cobre AC-1/AC-3
// de specs/E01-S37-botao-sincronizar-auvo/spec.md + as etapas novas de E01-S52/S54-S56/S58
// (deleted-tasks, gps e support-pull), que também devem falhar isoladas sem abortar o resto.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { type Caller, runSyncAll } from "./index.ts";

const ETAPAS_FIXAS = 6; // tasks-import + deleted-tasks + gps + questionnaires + expenses + satisfactions

Deno.test("runSyncAll — chama pull para cada entidade + etapas fixas, tudo ok", async () => {
  const chamadas: Array<{ path: string; body?: unknown }> = [];
  const caller: Caller = (path, body) => {
    chamadas.push({ path, body });
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll(["funcionarios", "clientes"], caller);

  assertEquals(resultado.ok, true);
  assertEquals(resultado.results.length, 2 + ETAPAS_FIXAS);
  assertEquals(chamadas, [
    { path: "pcm-auvo-pull", body: { entity: "funcionarios" } },
    { path: "pcm-auvo-pull", body: { entity: "clientes" } },
    { path: "pcm-auvo-tasks-import", body: undefined },
    { path: "pcm-auvo-deleted-tasks-sync", body: undefined },
    { path: "pcm-auvo-gps-pull", body: undefined },
    { path: "pcm-auvo-support-pull", body: { resource: "questionnaires" } },
    { path: "pcm-auvo-support-pull", body: { resource: "expenses" } },
    { path: "pcm-auvo-support-pull", body: { resource: "satisfactions" } },
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
  assertEquals(resultado.results.length, 3 + ETAPAS_FIXAS); // nenhum step pulado
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

Deno.test("runSyncAll — falha das etapas novas (gps/support) fica isolada e nomeada", async () => {
  const caller: Caller = (path, body) => {
    if (path === "pcm-auvo-gps-pull") return Promise.reject(new Error("GPS 500 simulado"));
    const resource = (body as { resource?: string } | undefined)?.resource;
    if (path === "pcm-auvo-support-pull" && resource === "satisfactions") {
      return Promise.reject(new Error("Satisfação 500 simulado"));
    }
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll(["funcionarios"], caller);

  assertEquals(resultado.ok, false);
  assertEquals(resultado.results.length, 1 + ETAPAS_FIXAS);
  assertEquals(resultado.results.find((r) => r.step === "gps")?.ok, false);
  assertEquals(resultado.results.find((r) => r.step === "gps")?.error, "GPS 500 simulado");
  assertEquals(resultado.results.find((r) => r.step === "satisfactions")?.ok, false);
  assertEquals(resultado.results.find((r) => r.step === "questionnaires")?.ok, true);
  assertEquals(resultado.results.find((r) => r.step === "expenses")?.ok, true);
  assertEquals(resultado.results.find((r) => r.step === "pull:funcionarios")?.ok, true);
});

Deno.test("runSyncAll — lista de entidades vazia roda só as etapas fixas", async () => {
  const chamadas: string[] = [];
  const caller: Caller = (path) => {
    chamadas.push(path);
    return Promise.resolve({ ok: true });
  };

  const resultado = await runSyncAll([], caller);

  assertEquals(resultado.ok, true);
  assertEquals(chamadas, [
    "pcm-auvo-tasks-import",
    "pcm-auvo-deleted-tasks-sync",
    "pcm-auvo-gps-pull",
    "pcm-auvo-support-pull",
    "pcm-auvo-support-pull",
    "pcm-auvo-support-pull",
  ]);
});

Deno.test("runSyncAll — repassa tasksImportBody pro tasks-import e pro deleted-tasks (backfill em fatias)", async () => {
  const chamadas: Array<{ path: string; body?: unknown }> = [];
  const caller: Caller = (path, body) => {
    chamadas.push({ path, body });
    return Promise.resolve({ ok: true });
  };

  const janela = { startDate: "2026-01-01T00:00:00", endDate: "2026-01-15T00:00:00" };
  await runSyncAll([], caller, janela);

  assertEquals(chamadas[0], { path: "pcm-auvo-tasks-import", body: janela });
  assertEquals(chamadas[1], { path: "pcm-auvo-deleted-tasks-sync", body: janela });
});
