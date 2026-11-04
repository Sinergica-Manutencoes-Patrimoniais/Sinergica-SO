import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classificarFalhaEnvioPreventiva } from "./confirmacao.ts";
import * as confirmacao from "./confirmacao.ts";

Deno.test("origemPreventivaLegada — aceita somente origem explícita legada", () => {
  const guard = (confirmacao as Record<string, unknown>).origemPreventivaLegada as ((valor: object) => boolean) | undefined;
  assertEquals(typeof guard, "function");
  assertEquals(guard?.({ origem: "legado" }), true);
  assertEquals(guard?.({ origem: "rotina" }), false);
  assertEquals(guard?.({ origem: null }), false);
  assertEquals(guard?.({}), false);
});

Deno.test("classificarFalhaEnvioPreventiva — falha antes da chamada Auvo permite retry", () => {
  assertEquals(classificarFalhaEnvioPreventiva(false, false), "falha");
});

Deno.test("classificarFalhaEnvioPreventiva — tentativa remota sem confirmação exige reconciliação", () => {
  assertEquals(classificarFalhaEnvioPreventiva(true, false), "incerto");
});

Deno.test("classificarFalhaEnvioPreventiva — rejeição HTTP conhecida permite retry", () => {
  assertEquals(classificarFalhaEnvioPreventiva(true, true), "falha");
});
