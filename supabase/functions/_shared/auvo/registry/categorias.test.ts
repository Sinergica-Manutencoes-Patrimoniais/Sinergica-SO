import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { equipamentoCategoriasDescriptor, produtoCategoriasDescriptor } from "./categorias.ts";

Deno.test("produtoCategoriasDescriptor — mapeia description e hard-delete", () => {
  assertEquals(produtoCategoriasDescriptor.auvoBasePath, "/productcategories");
  assertEquals(produtoCategoriasDescriptor.deleteStrategy, "hard-delete");
  // Sem cronSchedule de propósito — /productcategories confirmado 404 na API real (2026-07-08),
  // provável módulo não habilitado no plano Auvo da conta (equipmentcategories funciona normal).
  assertEquals(produtoCategoriasDescriptor.cronSchedule, undefined);
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
  assertEquals(equipamentoCategoriasDescriptor.cronSchedule, "0 6 * * *");
  assertEquals(equipamentoCategoriasDescriptor.toAuvo({ id: "c2", nome: "Climatização" }), {
    description: "Climatização",
  });
  assertEquals(equipamentoCategoriasDescriptor.fromAuvo({ id: 11, description: "Elétrica" }), {
    nome: "Elétrica",
  });
});
