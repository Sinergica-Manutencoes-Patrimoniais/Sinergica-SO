import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classificarFalhaEnvioPreventiva } from "./confirmacao.ts";

Deno.test("classificarFalhaEnvioPreventiva — falha antes da chamada Auvo permite retry", () => {
  assertEquals(classificarFalhaEnvioPreventiva(false, false), "falha");
});

Deno.test("classificarFalhaEnvioPreventiva — tentativa remota sem confirmação exige reconciliação", () => {
  assertEquals(classificarFalhaEnvioPreventiva(true, false), "incerto");
});

Deno.test("classificarFalhaEnvioPreventiva — rejeição HTTP conhecida permite retry", () => {
  assertEquals(classificarFalhaEnvioPreventiva(true, true), "falha");
});
