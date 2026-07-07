import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ferramentasDescriptor } from "./ferramentas.ts";

Deno.test("ferramentasDescriptor — mapeia /products com cron de 6h", () => {
  assertEquals(ferramentasDescriptor.auvoBasePath, "/products");
  assertEquals(ferramentasDescriptor.cronSchedule, "0 */6 * * *");
  assertEquals(ferramentasDescriptor.deleteStrategy, "soft-patch");

  assertEquals(
    ferramentasDescriptor.toAuvo({
      id: "30000000-0000-0000-0000-000000000001",
      nome: "Multímetro",
      descricao: "Multímetro Minipa",
      auvo_category_id: 77,
      quantidade_total: 4,
      quantidade_minima: 1,
      ativo: true,
    }),
    {
      name: "Multímetro",
      description: "Multímetro Minipa",
      categoryId: 77,
      totalStock: 4,
      minimumStock: 1,
      active: true,
    },
  );
});

Deno.test("ferramentasDescriptor — inbound preserva employeesStock como dado auxiliar", () => {
  assertEquals(
    ferramentasDescriptor.fromAuvo({
      id: 123,
      name: "Kit EPI",
      categoryId: 9,
      totalStock: 3,
      minimumStock: 1,
      active: true,
      employeesStock: [{ userId: 42, amount: 2 }],
    }),
    {
      nome: "Kit EPI",
      descricao: null,
      auvo_category_id: 9,
      quantidade_total: 3,
      quantidade_minima: 1,
      valor_unitario: null,
      custo_unitario: null,
      ativo: true,
      employees_stock: [{ userId: 42, amount: 2 }],
    },
  );
});
