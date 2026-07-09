import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractTaskId, mapTaskStatusToOsStatus, montarDetalhes } from "./index.ts";

Deno.test("extractTaskId — taskID é o campo real confirmado na API, id/taskId são fallback", () => {
  // Confirmado direto na API real (2026-07-09): GET /tasks devolve `taskID` (maiúsculo) — sem
  // isso, extractTaskId devolvia null pra toda tarefa e nenhuma OS nunca era criada.
  assertEquals(extractTaskId({ taskID: 789 }), 789);
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

Deno.test("montarDetalhes — E01-S38: só inclui chaves presentes, nunca inventa default", () => {
  assertEquals(
    montarDetalhes({ address: "Rua Exemplo, 123", latitude: -22.9, longitude: -47.0, priority: 3 }),
    { address: "Rua Exemplo, 123", latitude: -22.9, longitude: -47.0, priority: 3 },
  );
  assertEquals(montarDetalhes({}), {});
});
