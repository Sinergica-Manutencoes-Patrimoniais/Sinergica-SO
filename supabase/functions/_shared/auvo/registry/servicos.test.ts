import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decimalParaCentavos, servicosDescriptor } from "./servicos.ts";

Deno.test("servicosDescriptor — usa externalCode e auvo_id GUID/string", () => {
  assertEquals(servicosDescriptor.auvoBasePath, "/services");
  assertEquals(servicosDescriptor.externalIdField, "externalCode");
  assertEquals(servicosDescriptor.cronSchedule, "0 */6 * * *");

  assertEquals(
    servicosDescriptor.toAuvo({
      id: "31000000-0000-0000-0000-000000000001",
      titulo: "Instalação de Split",
      descricao: "Mão de obra",
      preco_centavos: 12990,
      ativo: true,
    }),
    {
      title: "Instalação de Split",
      description: "Mão de obra",
      price: 129.9,
      active: true,
    },
  );
});

Deno.test("servicosDescriptor — converte preço decimal para centavos sem guardar float", () => {
  assertEquals(decimalParaCentavos(129.9), 12990);
  assertEquals(
    servicosDescriptor.fromAuvo({
      id: "55f4d070-a9a7-4f3f-8a2b-c0d7ef6d88bb",
      title: "Visita técnica",
      price: 75.25,
      active: true,
    }),
    {
      titulo: "Visita técnica",
      descricao: null,
      preco_centavos: 7525,
      fiscal_service_id: null,
      ativo: true,
    },
  );
});
