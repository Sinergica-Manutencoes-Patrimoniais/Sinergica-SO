import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractEvolutionMessage, normalizarEventoEvolution } from "./evolution-webhook.ts";

Deno.test("extrai payload messages.upsert atual e preserva instanceName", () => {
  const message = extractEvolutionMessage({
    event: "MESSAGES_UPSERT",
    instance: "agente-chamados",
    data: {
      key: {
        id: "msg-1",
        remoteJid: "5511999990000@s.whatsapp.net",
        participant: "5511888880000@s.whatsapp.net",
        fromMe: false,
      },
      pushName: "Maria",
      messageTimestamp: 1_700_000_000,
      message: { conversation: "Preciso de manutenção" },
    },
  });
  assertEquals(message.instanceId, "agente-chamados");
  assertEquals(message.messageId, "msg-1");
  assertEquals(message.content, "Preciso de manutenção");
  assertEquals(message.fromMe, false);
});

Deno.test("marca mensagem enviada pela própria instância", () => {
  assertEquals(
    extractEvolutionMessage({
      instance: "agente-comercial",
      data: { key: { id: "msg-2", remoteJid: "5511@s.whatsapp.net", fromMe: true } },
    }).fromMe,
    true,
  );
});

Deno.test("normaliza nome de evento Evolution", () => {
  assertEquals(normalizarEventoEvolution("MESSAGES_UPSERT"), "messages.upsert");
  assertEquals(normalizarEventoEvolution(undefined), null);
});

Deno.test("extrai status broadcast para o chamador descartar", () => {
  const message = extractEvolutionMessage({
    instance: "agente-chamados",
    data: { key: { id: "msg-status", remoteJid: "status@broadcast", fromMe: false } },
  });
  assertEquals(message.remoteJid?.endsWith("@broadcast"), true);
});
