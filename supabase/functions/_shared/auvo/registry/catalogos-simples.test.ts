import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { palavrasChaveDescriptor, segmentosDescriptor } from "./catalogos-simples.ts";

Deno.test("segmentosDescriptor — mapeia description e hard-delete", () => {
  assertEquals(segmentosDescriptor.auvoBasePath, "/segments");
  assertEquals(segmentosDescriptor.deleteStrategy, "hard-delete");
  assertEquals(segmentosDescriptor.toAuvo({ id: "s1", descricao: "Condomínio" }), {
    description: "Condomínio",
  });
  assertEquals(segmentosDescriptor.fromAuvo({ id: 10, description: "Residencial" }), {
    descricao: "Residencial",
  });
});

Deno.test("palavrasChaveDescriptor — mapeia description e hard-delete", () => {
  assertEquals(palavrasChaveDescriptor.auvoBasePath, "/keywords");
  assertEquals(palavrasChaveDescriptor.deleteStrategy, "hard-delete");
  assertEquals(palavrasChaveDescriptor.toAuvo({ id: "k1", descricao: "PMOC" }), {
    description: "PMOC",
  });
  assertEquals(palavrasChaveDescriptor.fromAuvo({ id: 11, description: "SPDA" }), {
    descricao: "SPDA",
  });
});
