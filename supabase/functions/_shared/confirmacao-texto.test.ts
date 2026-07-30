import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { interpretarConfirmacao, montarResumoPendentes } from "./confirmacao-texto.ts";

Deno.test("interpretarConfirmacao — confirma", () => {
  assertEquals(interpretarConfirmacao("sim, pode abrir"), "confirma");
  assertEquals(interpretarConfirmacao("Isso mesmo"), "confirma");
  assertEquals(interpretarConfirmacao("beleza, manda"), "confirma");
  assertEquals(interpretarConfirmacao("OK"), "confirma");
});

Deno.test("interpretarConfirmacao — nega (checada antes de confirma)", () => {
  assertEquals(interpretarConfirmacao("não, cancela"), "nega");
  assertEquals(interpretarConfirmacao("Nao, espera"), "nega");
  assertEquals(interpretarConfirmacao("errado, corrige"), "nega");
});

Deno.test("interpretarConfirmacao — ambíguo quando não reconhece vocabulário", () => {
  assertEquals(interpretarConfirmacao("qual o prazo disso?"), "ambiguo");
  assertEquals(interpretarConfirmacao(""), "ambiguo");
  assertEquals(interpretarConfirmacao("   "), "ambiguo");
});

Deno.test("interpretarConfirmacao — tolera acento (não/nao)", () => {
  assertEquals(interpretarConfirmacao("não"), "nega");
  assertEquals(interpretarConfirmacao("nao"), "nega");
});

Deno.test("montarResumoPendentes — um item: frase única", () => {
  const resumo = montarResumoPendentes([
    { titulo: "Trocar lâmpada", descricao: "Lâmpada queimada", local_descricao: "Hall térreo" },
  ]);
  assertStringIncludes(resumo, "Trocar lâmpada");
  assertStringIncludes(resumo, "Hall térreo");
  assertStringIncludes(resumo, "Confirma?");
});

Deno.test("montarResumoPendentes — múltiplos itens: lista numerada", () => {
  const resumo = montarResumoPendentes([
    { titulo: "Trocar lâmpada", descricao: "d1", local_descricao: "Hall térreo" },
    { titulo: "Verificar registro", descricao: "d2", local_descricao: "3º andar" },
  ]);
  assertStringIncludes(resumo, "2 chamados");
  assertStringIncludes(resumo, "1) Trocar lâmpada — Hall térreo");
  assertStringIncludes(resumo, "2) Verificar registro — 3º andar");
});
