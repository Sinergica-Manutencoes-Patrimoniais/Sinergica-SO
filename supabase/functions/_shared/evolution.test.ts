import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarPayloadTexto, extrairWaMessageId, telefoneParaRemoteJid } from "./evolution.ts";

Deno.test("Evolution — texto usa number + text (payload plano, confirmado contra instância real)", () => {
  assertEquals(criarPayloadTexto("5511999999999@s.whatsapp.net", " Olá "), {
    number: "5511999999999@s.whatsapp.net",
    text: "Olá",
  });
});

Deno.test("Evolution — payload de texto vazio falha antes da rede", () => {
  assertThrows(() => criarPayloadTexto("5511999999999@s.whatsapp.net", "  "));
  assertThrows(() => criarPayloadTexto(" ", "Olá"));
});

Deno.test("Evolution — telefone brasileiro vira remote JID", () => {
  assertEquals(telefoneParaRemoteJid("(11) 99999-0000"), "5511999990000@s.whatsapp.net");
});

Deno.test("Evolution — extrai wa_message_id de key.id (formato oficial de resposta do sendText)", () => {
  assertEquals(
    extrairWaMessageId({
      key: { remoteJid: "553198296801@s.whatsapp.net", fromMe: true, id: "BAE594145F4C59B4" },
      message: { extendedTextMessage: { text: "Olá!" } },
      messageTimestamp: "1717689097",
      status: "PENDING",
    }),
    "BAE594145F4C59B4",
  );
});

Deno.test("Evolution — extração de wa_message_id é best-effort, nunca lança", () => {
  assertEquals(extrairWaMessageId(null), null);
  assertEquals(extrairWaMessageId(undefined), null);
  assertEquals(extrairWaMessageId({}), null);
  assertEquals(extrairWaMessageId({ key: {} }), null);
  assertEquals(extrairWaMessageId({ key: { id: 123 } }), null);
  assertEquals(extrairWaMessageId("string qualquer"), null);
});

