import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractTaskId, mapTaskStatusToOsStatus } from "./index.ts";

Deno.test("extractTaskId — aceita id ou taskId, ignora tarefa sem nenhum dos dois", () => {
  assertEquals(extractTaskId({ id: 123 }), 123);
  assertEquals(extractTaskId({ taskId: 456 }), 456);
  assertEquals(extractTaskId({}), null);
});

Deno.test("mapTaskStatusToOsStatus — mapeia taskStatus Auvo pro status inicial da OS", () => {
  assertEquals(mapTaskStatusToOsStatus(5), "finalizado");
  assertEquals(mapTaskStatusToOsStatus(2), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(3), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(4), "em_execucao");
  assertEquals(mapTaskStatusToOsStatus(1), "solicitacao");
  assertEquals(mapTaskStatusToOsStatus(6), "solicitacao");
  assertEquals(mapTaskStatusToOsStatus(undefined), "solicitacao");
});
