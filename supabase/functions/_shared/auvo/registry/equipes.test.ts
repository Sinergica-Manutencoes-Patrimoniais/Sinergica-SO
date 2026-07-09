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

Deno.test("equipesDescriptor — inbound: teamUsers/teamManagers reais são nomes, não ids — arrays ficam vazios", () => {
  // Confirmado direto na API real (2026-07-08): GET /teams devolve teamUsers/teamManagers como
  // arrays de nome (string), não participants/managers com ids numéricos. Ver migration 0069:
  // esse mismatch fazia fromAuvo produzir array vazio, e fn_upsert_auvo_sync gravava NULL numa
  // coluna NOT NULL, causando 500 em todo pull:equipes.
  assertEquals(
    equipesDescriptor.fromAuvo({
      id: 77,
      description: "Plantão",
      teamUsers: ["Eng. Fabrício Medeiros", "Weslei Costa"],
      teamManagers: [],
    }),
    {
      nome: "Plantão",
      participantes_auvo_ids: [],
      gestores_auvo_ids: [],
      ativo: true,
    },
  );
});
