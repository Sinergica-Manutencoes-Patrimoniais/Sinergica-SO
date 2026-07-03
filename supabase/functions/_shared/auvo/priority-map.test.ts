// priority-map.test.ts — teste unitário puro do mapeamento prioridade (GUT) → priority (Auvo).
// Ver nota SPEC_DEVIATION em priority-map.ts (mapeamento provisório, pendente confirmação
// Fabrício). Rodar localmente (requer Deno CLI, indisponível neste ambiente):
//   deno test supabase/functions/_shared/auvo/priority-map.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveAuvoPriority } from "./priority-map.ts";

Deno.test("resolveAuvoPriority — critica mapeia para 3", () => {
  assertEquals(resolveAuvoPriority("critica"), 3);
});

Deno.test("resolveAuvoPriority — alta mapeia para 3", () => {
  assertEquals(resolveAuvoPriority("alta"), 3);
});

Deno.test("resolveAuvoPriority — media mapeia para 2", () => {
  assertEquals(resolveAuvoPriority("media"), 2);
});

Deno.test("resolveAuvoPriority — baixa mapeia para 1", () => {
  assertEquals(resolveAuvoPriority("baixa"), 1);
});

Deno.test("resolveAuvoPriority — valor desconhecido (ex.: default 'normal' da coluna) cai no fallback médio, nunca lança erro", () => {
  assertEquals(resolveAuvoPriority("normal"), 2);
  assertEquals(resolveAuvoPriority(""), 2);
});
