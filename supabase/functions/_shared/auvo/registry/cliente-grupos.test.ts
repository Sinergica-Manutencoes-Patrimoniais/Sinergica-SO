import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clienteGruposDescriptor } from "./cliente-grupos.ts";

Deno.test("clienteGruposDescriptor — /customergroups usa hard-delete e update no-op", () => {
  assertEquals(clienteGruposDescriptor.auvoBasePath, "/customergroups");
  assertEquals(clienteGruposDescriptor.deleteStrategy, "hard-delete");
  assertEquals(clienteGruposDescriptor.supportsUpdate, false);
  assertEquals(
    clienteGruposDescriptor.toAuvo({
      id: "g1",
      nome: "Condomínios SP",
      clientes_auvo_ids: [10, 11],
    }),
    { description: "Condomínios SP", clientsId: [10, 11] },
  );
  assertEquals(clienteGruposDescriptor.fromAuvo({ id: 9, description: "Residenciais" }), {
    nome: "Residenciais",
  });
});
