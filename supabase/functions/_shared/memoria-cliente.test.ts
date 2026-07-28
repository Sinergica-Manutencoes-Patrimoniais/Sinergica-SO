import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { comporContextoCliente } from "./memoria-cliente.ts";

Deno.test("comporContextoCliente — sem alma nem resumo devolve null (sem ruído no prompt)", () => {
  assertEquals(comporContextoCliente(null, null), null);
  assertEquals(comporContextoCliente("", ""), null);
  assertEquals(comporContextoCliente("   ", undefined), null);
});

Deno.test("comporContextoCliente — só alma", () => {
  const contexto = comporContextoCliente("Síndico prefere áudio, é direto", null);
  assertStringIncludes(contexto ?? "", "Síndico prefere áudio");
});

Deno.test("comporContextoCliente — só resumo", () => {
  const contexto = comporContextoCliente(null, "Cliente reclamou de vazamento em 2026-06");
  assertStringIncludes(contexto ?? "", "vazamento");
});

Deno.test("comporContextoCliente — alma + resumo, seções distintas", () => {
  const contexto = comporContextoCliente("prefere áudio", "vazamento resolvido em junho");
  assertStringIncludes(contexto ?? "", "prefere áudio");
  assertStringIncludes(contexto ?? "", "vazamento resolvido");
});

Deno.test("comporContextoCliente — isolamento: contexto de um cliente nunca vaza pro outro (mesma chamada nunca mistura 2 clientes)", () => {
  const clienteA = comporContextoCliente("info do cliente A", null);
  const clienteB = comporContextoCliente("info do cliente B", null);
  assertEquals(clienteA?.includes("cliente B"), false);
  assertEquals(clienteB?.includes("cliente A"), false);
});
