import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { horarioDoAparelho, textoDoAparelho } from "./evolution-aparelho.ts";

Deno.test("textoDoAparelho — conversation simples", () => {
  assertEquals(textoDoAparelho({ conversation: "oi" }), "oi");
});

Deno.test("textoDoAparelho — extendedTextMessage", () => {
  assertEquals(textoDoAparelho({ extendedTextMessage: { text: "resposta" } }), "resposta");
});

Deno.test("textoDoAparelho — marcador de imagem sem legenda", () => {
  assertEquals(textoDoAparelho({ imageMessage: {} }), "[Imagem enviada pelo aparelho]");
});

Deno.test("textoDoAparelho — marcador de imagem com legenda", () => {
  assertEquals(
    textoDoAparelho({ imageMessage: { caption: "segue o comprovante" } }),
    "[Imagem enviada pelo aparelho] segue o comprovante",
  );
});

Deno.test("textoDoAparelho — marcador de áudio, documento, figurinha, localização, contato", () => {
  assertEquals(textoDoAparelho({ audioMessage: {} }), "[Áudio enviado pelo aparelho]");
  assertEquals(textoDoAparelho({ documentMessage: {} }), "[Documento enviado pelo aparelho]");
  assertEquals(textoDoAparelho({ stickerMessage: {} }), "[Figurinha enviada pelo aparelho]");
  assertEquals(textoDoAparelho({ locationMessage: {} }), "[Localização enviada pelo aparelho]");
  assertEquals(textoDoAparelho({ contactMessage: {} }), "[Contato enviado pelo aparelho]");
});

Deno.test("textoDoAparelho — desembrulha ephemeralMessage/viewOnceMessage", () => {
  assertEquals(
    textoDoAparelho({ ephemeralMessage: { message: { conversation: "do fundo" } } }),
    "do fundo",
  );
  assertEquals(
    textoDoAparelho({ viewOnceMessage: { message: { imageMessage: { caption: "foto" } } } }),
    "[Imagem enviada pelo aparelho] foto",
  );
});

Deno.test("textoDoAparelho — fallback para tipo totalmente desconhecido", () => {
  assertEquals(textoDoAparelho({ algumTipoNovo: {} }), "[Mensagem enviada pelo aparelho]");
});

Deno.test("textoDoAparelho — NUNCA usa pushName (não é parâmetro da função)", () => {
  // pushName não é nem aceito como argumento — a assinatura da função já impede isso por
  // construção; este teste documenta a intenção (ADR-1688).
  const resultado = textoDoAparelho({ conversation: "oi" });
  assertEquals(resultado, "oi");
});

Deno.test("textoDoAparelho — trunca em 4000 caracteres", () => {
  const longo = "a".repeat(5000);
  const resultado = textoDoAparelho({ conversation: longo });
  assertEquals(resultado.length, 4000);
  assertEquals(resultado.endsWith("…"), true);
});

Deno.test("horarioDoAparelho — número, string numérica, inválidos", () => {
  assertEquals(horarioDoAparelho(1700000000)?.getTime(), 1700000000 * 1000);
  assertEquals(horarioDoAparelho("1700000000")?.getTime(), 1700000000 * 1000);
  assertEquals(horarioDoAparelho(0), null);
  assertEquals(horarioDoAparelho(-5), null);
  assertEquals(horarioDoAparelho("não é número"), null);
  assertEquals(horarioDoAparelho(null), null);
  assertEquals(horarioDoAparelho(undefined), null);
});
