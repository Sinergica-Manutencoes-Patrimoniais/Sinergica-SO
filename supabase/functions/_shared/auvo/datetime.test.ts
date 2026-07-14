import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { auvoNaiveToUtc } from "./datetime.ts";

Deno.test("auvoNaiveToUtc — naive (sem offset) é tratado como Brasília -03:00", () => {
  assertEquals(auvoNaiveToUtc("2026-07-13T08:00:00"), "2026-07-13T11:00:00.000Z");
});

Deno.test("auvoNaiveToUtc — naive à meia-noite BRT vira dia seguinte em UTC", () => {
  assertEquals(auvoNaiveToUtc("2026-07-13T23:30:00"), "2026-07-14T02:30:00.000Z");
});

Deno.test("auvoNaiveToUtc — já tem Z, não desloca de novo", () => {
  assertEquals(auvoNaiveToUtc("2026-07-13T11:00:00Z"), "2026-07-13T11:00:00.000Z");
});

Deno.test("auvoNaiveToUtc — já tem offset explícito, não desloca de novo", () => {
  assertEquals(auvoNaiveToUtc("2026-07-13T08:00:00-03:00"), "2026-07-13T11:00:00.000Z");
});

Deno.test("auvoNaiveToUtc — vazio/nulo/undefined devolve null", () => {
  assertEquals(auvoNaiveToUtc(""), null);
  assertEquals(auvoNaiveToUtc(null), null);
  assertEquals(auvoNaiveToUtc(undefined), null);
});

Deno.test("auvoNaiveToUtc — string inválida devolve null, nunca lança", () => {
  assertEquals(auvoNaiveToUtc("não é uma data"), null);
});
