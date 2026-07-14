import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decimalParaCentavos, servicosDescriptor } from "./servicos.ts";

Deno.test("servicosDescriptor — usa externalCode e auvo_id GUID/string", () => {
  assertEquals(servicosDescriptor.auvoBasePath, "/services");
  assertEquals(servicosDescriptor.externalIdField, "externalCode");
  // Sem cronSchedule de propósito — GET /services (listagem) confirmado 404 na API real
  // (2026-07-08, reconfirmado 2026-07-14/E01-S74). POST/PATCH/GET-por-id funcionam; ver comentário
  // no descriptor.
  assertEquals(servicosDescriptor.cronSchedule, undefined);
  // E01-S74: teste de contrato ao vivo confirmou POST /services aceito — write path habilitado.
  assertEquals(servicosDescriptor.writeEnabled, true);

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

Deno.test("servicosDescriptor — extractCreatedAuvoId aceita GUID string (confirmado ao vivo, E01-S74)", () => {
  const id = servicosDescriptor.extractCreatedAuvoId?.({
    result: { id: "5d271e4e-7198-4e5d-a88d-72365464ec92", title: "X", price: 0.01, active: true },
  });
  assertEquals(id, "5d271e4e-7198-4e5d-a88d-72365464ec92");
});

Deno.test("servicosDescriptor — extractCreatedAuvoId devolve null sem result.id", () => {
  assertEquals(servicosDescriptor.extractCreatedAuvoId?.({ result: {} }), null);
  assertEquals(servicosDescriptor.extractCreatedAuvoId?.({}), null);
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
