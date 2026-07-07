// registry/index.test.ts — teste unitário do agregador do entity registry (E01-S22).
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/registry/index.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getDescriptor, listEntities } from "./index.ts";

Deno.test("getDescriptor — chave desconhecida devolve undefined, nunca lança", () => {
  assertEquals(getDescriptor("entidade-que-nao-existe"), undefined);
});

Deno.test("listEntities — vazio nesta story (nenhum descriptor concreto registrado ainda)", () => {
  assertEquals(listEntities(), []);
});
