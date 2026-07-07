import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { equipamentoCategoriasDescriptor, produtoCategoriasDescriptor } from "./categorias.ts";

Deno.test("produtoCategoriasDescriptor — mapeia description e hard-delete", () => {
  assertEquals(produtoCategoriasDescriptor.auvoBasePath, "/productcategories");
  assertEquals(produtoCategoriasDescriptor.deleteStrategy, "hard-delete");
  assertEquals(produtoCategoriasDescriptor.toAuvo({ id: "c1", nome: "Ferramentas" }), {
    description: "Ferramentas",
  });
  assertEquals(produtoCategoriasDescriptor.fromAuvo({ id: 10, description: "Kits" }), {
    nome: "Kits",
  });
});

Deno.test("equipamentoCategoriasDescriptor — mapeia description e hard-delete", () => {
  assertEquals(equipamentoCategoriasDescriptor.auvoBasePath, "/equipmentcategories");
  assertEquals(equipamentoCategoriasDescriptor.deleteStrategy, "hard-delete");
  assertEquals(equipamentoCategoriasDescriptor.toAuvo({ id: "c2", nome: "Climatização" }), {
    description: "Climatização",
  });
  assertEquals(equipamentoCategoriasDescriptor.fromAuvo({ id: 11, description: "Elétrica" }), {
    nome: "Elétrica",
  });
});
