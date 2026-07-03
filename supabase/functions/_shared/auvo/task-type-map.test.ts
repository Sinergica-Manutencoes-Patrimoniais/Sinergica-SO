// task-type-map.test.ts — teste unitário puro do mapeamento categoria → taskTypeId.
// Nenhum outro *.test.ts existe hoje em supabase/functions/ (verificado antes de escrever este
// arquivo) — não há runner de teste Deno configurado no CI deste repo ainda (ver relatório da
// story E01-S09). Convenção adotada: Deno.test + std/assert (biblioteca padrão do runtime, sem
// dependência nova), mesma versão pinada já usada em _template/index.ts (0.224.0).
// Rodar localmente (requer Deno CLI, indisponível neste ambiente de implementação):
//   deno test supabase/functions/_shared/auvo/task-type-map.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { AUVO_TASK_TYPE_MAP, resolveAuvoTaskTypeId } from "./task-type-map.ts";

Deno.test("resolveAuvoTaskTypeId — corretiva mapeia para 228714", () => {
  assertEquals(resolveAuvoTaskTypeId("corretiva"), 228714);
});

Deno.test("resolveAuvoTaskTypeId — preventiva mapeia para 139989", () => {
  assertEquals(resolveAuvoTaskTypeId("preventiva"), 139989);
});

Deno.test("resolveAuvoTaskTypeId — inspecao mapeia para 179776", () => {
  assertEquals(resolveAuvoTaskTypeId("inspecao"), 179776);
});

Deno.test("resolveAuvoTaskTypeId — levantamento não tem mapeamento (AC-7: lookup miss, não crash)", () => {
  assertEquals(resolveAuvoTaskTypeId("levantamento"), undefined);
});

Deno.test("resolveAuvoTaskTypeId — emergencial não tem mapeamento (AC-7: lookup miss, não crash)", () => {
  assertEquals(resolveAuvoTaskTypeId("emergencial"), undefined);
});

Deno.test("resolveAuvoTaskTypeId — categoria desconhecida não tem mapeamento", () => {
  assertEquals(resolveAuvoTaskTypeId("categoria-inexistente"), undefined);
});

Deno.test("AUVO_TASK_TYPE_MAP — só contém as 3 categorias com taskTypeId confirmado", () => {
  assertEquals(Object.keys(AUVO_TASK_TYPE_MAP).sort(), ["corretiva", "inspecao", "preventiva"]);
});
