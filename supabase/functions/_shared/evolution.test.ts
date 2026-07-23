import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarPayloadTexto, telefoneParaRemoteJid } from "./evolution.ts";

Deno.test("Evolution 2.3 — texto usa number + textMessage.text", () => {
  assertEquals(criarPayloadTexto("5511999999999@s.whatsapp.net", " Olá "), {
    number: "5511999999999@s.whatsapp.net",
    textMessage: { text: "Olá" },
  });
});

Deno.test("Evolution — payload de texto vazio falha antes da rede", () => {
  assertThrows(() => criarPayloadTexto("5511999999999@s.whatsapp.net", "  "));
  assertThrows(() => criarPayloadTexto(" ", "Olá"));
});

Deno.test("Evolution — telefone brasileiro vira remote JID", () => {
  assertEquals(telefoneParaRemoteJid("(11) 99999-0000"), "5511999990000@s.whatsapp.net");
});

