// json-patch.test.ts — teste unitário puro (sem rede) do conversor de patch flat → JSON Patch da Auvo v2.
// Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/json-patch.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toAuvoJsonPatch } from "./json-patch.ts";

Deno.test("toAuvoJsonPatch — converte cada campo num op replace, path sem barra inicial", () => {
  const resultado = toAuvoJsonPatch({ active: false, name: "X" });
  assertEquals(resultado, [
    { op: "replace", path: "active", value: false },
    { op: "replace", path: "name", value: "X" },
  ]);
});

Deno.test("toAuvoJsonPatch — objeto vazio devolve array vazio", () => {
  assertEquals(toAuvoJsonPatch({}), []);
});

Deno.test("toAuvoJsonPatch — preserva valor null explícito", () => {
  assertEquals(toAuvoJsonPatch({ auvo_sync_error: null }), [
    { op: "replace", path: "auvo_sync_error", value: null },
  ]);
});
