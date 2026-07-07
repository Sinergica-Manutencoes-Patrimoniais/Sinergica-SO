import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { equipesDescriptor } from "./equipes.ts";

Deno.test("equipesDescriptor — cria teams e bloqueia update/delete no Auvo", () => {
  assertEquals(equipesDescriptor.auvoBasePath, "/teams");
  assertEquals(equipesDescriptor.supportsUpdate, false);
  assertEquals(equipesDescriptor.deleteStrategy, "unsupported");
  assertEquals(equipesDescriptor.cronSchedule, "0 */6 * * *");

  assertEquals(
    equipesDescriptor.toAuvo({
      id: "32000000-0000-0000-0000-000000000001",
      nome: "Time HVAC",
      participantes_auvo_ids: [10, 11, 11],
      gestores_auvo_ids: [99],
    }),
    {
      description: "Time HVAC",
      participants: [10, 11],
      managers: [99],
    },
  );
});

Deno.test("equipesDescriptor — inbound normaliza participantes", () => {
  assertEquals(
    equipesDescriptor.fromAuvo({
      id: 77,
      description: "Plantão",
      participants: [1, 2],
      managers: [3],
    }),
    {
      nome: "Plantão",
      participantes_auvo_ids: [1, 2],
      gestores_auvo_ids: [3],
      ativo: true,
    },
  );
});
