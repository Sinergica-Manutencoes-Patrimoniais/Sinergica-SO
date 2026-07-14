import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { equipamentosDescriptor } from "./equipamentos.ts";

Deno.test("equipamentosDescriptor — mapeia equipamento para /equipments com webhook entity 27", () => {
  assertEquals(equipamentosDescriptor.auvoBasePath, "/equipments");
  assertEquals(equipamentosDescriptor.webhookEntity, 27);
  assertEquals(
    equipamentosDescriptor.toAuvo({
      id: "e1",
      nome: "Bomba 1",
      identificador: "B-001",
      categoria: "Bomba",
      auvo_customer_id: 99,
      ativo: true,
    }),
    {
      name: "Bomba 1",
      description: "Bomba 1",
      identifier: "B-001",
      category: "Bomba",
      associatedCustomerId: 99,
      customerId: 99,
      active: true,
    },
  );
});

Deno.test("equipamentosDescriptor — inbound preserva ids Auvo e vínculo de cliente", () => {
  assertEquals(
    equipamentosDescriptor.fromAuvo({
      equipmentId: 42,
      name: "Ar condicionado",
      associatedCustomerId: 77,
      active: false,
    }),
    {
      auvo_equipment_id: 42,
      nome: "Ar condicionado",
      identificador: null,
      categoria: null,
      auvo_customer_id: 77,
      localizacao: null,
      observacoes: null,
      ativo: false,
      url_imagem: null,
      uri_anexos: [],
    },
  );
});

Deno.test("equipamentosDescriptor — E01-S71 captura urlImage e uriAnexos do Auvo", () => {
  const linha = equipamentosDescriptor.fromAuvo({
    equipmentId: 42,
    name: "Ar condicionado",
    urlImage: "https://auvo-s3.example.com/equipments/42.jpg",
    uriAnexos: ["https://auvo-s3.example.com/equipments/42-manual.pdf"],
  });
  assertEquals(linha.url_imagem, "https://auvo-s3.example.com/equipments/42.jpg");
  assertEquals(linha.uri_anexos, ["https://auvo-s3.example.com/equipments/42-manual.pdf"]);
});

Deno.test("equipamentosDescriptor — sem urlImage/uriAnexos vira null/array vazio", () => {
  const linha = equipamentosDescriptor.fromAuvo({ equipmentId: 43, name: "Bomba" });
  assertEquals(linha.url_imagem, null);
  assertEquals(linha.uri_anexos, []);
});
