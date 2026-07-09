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

Deno.test("ferramentasDescriptor — inbound real: unitaryValue/unitaryCost vêm como string em moeda", () => {
  // Confirmado direto na API real (2026-07-09): GET /products devolve `"$0.00"` (string), não
  // number — valor_unitario/custo_unitario sempre viravam null antes desse fix.
  assertEquals(
    ferramentasDescriptor.fromAuvo({
      id: 7304387,
      name: "Teste Martelo",
      categoryId: 0,
      totalStock: 0,
      minimumStock: 0,
      active: true,
      unitaryValue: "$129.90",
      unitaryCost: "$0.00",
    }),
    {
      nome: "Teste Martelo",
      descricao: null,
      auvo_category_id: 0,
      quantidade_total: 0,
      quantidade_minima: 0,
      valor_unitario: 129.9,
      custo_unitario: 0,
      ativo: true,
      employees_stock: undefined,
    },
  );
});
