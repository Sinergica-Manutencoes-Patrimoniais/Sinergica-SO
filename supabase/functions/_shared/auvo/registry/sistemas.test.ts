import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sistemasDescriptor } from "./sistemas.ts";

Deno.test("sistemasDescriptor — mapeia sistema para /equipments, push-only e writeEnabled false", () => {
  assertEquals(sistemasDescriptor.auvoBasePath, "/equipments");
  assertEquals(sistemasDescriptor.pcmTable, "sistemas");
  assertEquals(sistemasDescriptor.writeEnabled, false);
  assertEquals(sistemasDescriptor.webhookEntity, undefined);
});

Deno.test("sistemasDescriptor — toAuvo mapeia nome/descricao/codigo/ativo", () => {
  assertEquals(
    sistemasDescriptor.toAuvo({
      id: "s1",
      nome: "Sistema Hidrante",
      descricao: "Rede de hidrantes prediais",
      codigo: "SH-001",
      ativo: true,
      auvo_customer_id: 99,
    }),
    {
      name: "Sistema Hidrante",
      description: "Rede de hidrantes prediais",
      associatedCustomerId: 99,
      identifier: "SH-001",
      active: true,
    },
  );
});

Deno.test("sistemasDescriptor — E01-S85 AC-4: envia auvo_localizacao (nome da Área) quando presente", () => {
  const payload = sistemasDescriptor.toAuvo({
    id: "s1",
    nome: "Sistema Hidrante",
    auvo_localizacao: "Torre A",
  });
  assertEquals(payload.location, "Torre A");
});

Deno.test("sistemasDescriptor — E01-S85 AC-4: sem Área vinculada, location some do payload", () => {
  const payload = sistemasDescriptor.toAuvo({
    id: "s1",
    nome: "Sistema Hidrante",
    auvo_localizacao: null,
  });
  assertEquals("location" in payload, false);
});

Deno.test("sistemasDescriptor — inbound preserva id Auvo, código e status ativo", () => {
  assertEquals(
    sistemasDescriptor.fromAuvo({ equipmentId: 55, name: "Sistema X", identifier: "SX-1" }),
    {
      auvo_equipment_id: 55,
      nome: "Sistema X",
      codigo: "SX-1",
      ativo: true,
    },
  );
});
