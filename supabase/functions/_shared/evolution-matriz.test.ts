import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as deno from "./evolution-matriz.ts";
// Lado Vite — Deno consegue importar por path relativo porque o arquivo não tem import algum
// (é puro TS sem dependência externa). Se um dia ganhar um import, este teste de paridade quebra
// primeiro e avisa que o espelho manual voltou a ser necessário.
import * as vite from "../../../apps/web/src/features/atendimento/domain/evolution-compatibilidade.ts";

Deno.test("paridade — CAPACIDADES_OBRIGATORIAS é idêntica nos dois lados", () => {
  assertEquals(deno.CAPACIDADES_OBRIGATORIAS, vite.CAPACIDADES_OBRIGATORIAS);
});

Deno.test("paridade — MATRIZ_DE_COMPATIBILIDADE é idêntica nos dois lados", () => {
  assertEquals(deno.MATRIZ_DE_COMPATIBILIDADE, vite.MATRIZ_DE_COMPATIBILIDADE);
});

Deno.test("paridade — avaliarCompatibilidade concorda para a mesma bateria de versões", () => {
  for (const versao of ["2.1.1", "2.0.0", "9.9.9", ""]) {
    assertEquals(
      deno.avaliarCompatibilidade(deno.MATRIZ_DE_COMPATIBILIDADE, versao),
      vite.avaliarCompatibilidade(vite.MATRIZ_DE_COMPATIBILIDADE, versao),
      `divergência para versão "${versao}"`,
    );
  }
});
