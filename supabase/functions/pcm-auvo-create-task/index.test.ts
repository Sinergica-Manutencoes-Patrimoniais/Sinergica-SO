import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extrairTaskIdAuvo, montarPayloadTaskAuvo } from "./index.ts";

Deno.test("montarPayloadTaskAuvo — envia tipo e alvo com nomes do contrato Auvo", () => {
  assertEquals(
    montarPayloadTaskAuvo({
      externalId: "os-1",
      customerId: 2,
      taskType: 3,
      priority: 1,
      orientation: "Inspecionar",
      equipmentId: 9,
    }),
    {
      externalId: "os-1",
      customerId: 2,
      taskType: 3,
      priority: 1,
      orientation: "Inspecionar",
      equipmentsId: [9],
    },
  );
});

Deno.test("extrairTaskIdAuvo — lê taskID em result array", () => {
  assertEquals(extrairTaskIdAuvo({ result: [{ taskID: 80612378 }] }), 80612378);
});
