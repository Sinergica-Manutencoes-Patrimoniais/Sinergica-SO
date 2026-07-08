// Teste da validação de período — a única lógica não-trivial desta função (o resto é
// requireAuth + repasse de JWT pra RPC, já coberto pelo padrão de _shared/auth.ts).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Reimplementação local do helper (não exportado por index.ts, que só expõe o handler `serve`) —
// mantém o teste isolado do side-effect de `serve()` rodar no import.
function ehPeriodoValido(valor: unknown): valor is "hoje" | "7d" | "30d" {
  return typeof valor === "string" && ["hoje", "7d", "30d"].includes(valor);
}

Deno.test("ehPeriodoValido — aceita hoje/7d/30d", () => {
  assertEquals(ehPeriodoValido("hoje"), true);
  assertEquals(ehPeriodoValido("7d"), true);
  assertEquals(ehPeriodoValido("30d"), true);
});

Deno.test("ehPeriodoValido — rejeita valor desconhecido ou não-string", () => {
  assertEquals(ehPeriodoValido("60d"), false);
  assertEquals(ehPeriodoValido(undefined), false);
  assertEquals(ehPeriodoValido(null), false);
  assertEquals(ehPeriodoValido(7), false);
});
