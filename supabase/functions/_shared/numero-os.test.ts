import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { identidadeOsProvisoria } from "./numero-os.ts";

Deno.test("identidade provisória mantém UUID e mesma convenção PRE do banco", () => {
  assertEquals(identidadeOsProvisoria("abcdef01-0000-4000-8000-000000000001"), { id: "abcdef01-0000-4000-8000-000000000001", numero: "PRE-ABCDEF01" });
});
Deno.test("identidade provisória rejeita id inválido sem gerar número ambíguo", () => {
  assertThrows(() => identidadeOsProvisoria("inválido"));
});
