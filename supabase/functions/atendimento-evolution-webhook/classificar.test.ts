import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classificarEventoEvolution } from "./classificar.ts";
// Lado Vite — Deno importa por path relativo porque o arquivo é puro TS sem import algum.
import { classificarEventoEvolution as classificarVite } from "../../../apps/web/src/features/atendimento/domain/evento-evolution.ts";

interface Extra {
  key?: Record<string, unknown>;
  [outro: string]: unknown;
}

function evento(message: Record<string, unknown>, extra: Extra = {}) {
  const { key: chaveExtra, ...resto } = extra;
  return {
    event: "MESSAGES_UPSERT",
    data: {
      key: { remoteJid: "5511999999999@s.whatsapp.net", id: "ABC123", fromMe: false, ...chaveExtra },
      message,
      ...resto,
    },
  };
}

const BATERIA: unknown[] = [
  null,
  undefined,
  {},
  { event: "CONNECTION_UPDATE" },
  evento({ conversation: "Oi, tudo bem?" }),
  evento({ extendedTextMessage: { text: "resposta", contextInfo: { stanzaId: "MSG1" } } }),
  evento({ audioMessage: { mimetype: "audio/ogg", seconds: 12.4 } }),
  evento({ imageMessage: { caption: "foto" } }),
  evento({ stickerMessage: { caption: "ignorado" } }),
  evento({ locationMessage: {} }),
  evento({ reactionMessage: { key: { id: "MSG_REAGIDA" }, text: "👍" } }),
  evento({ reactionMessage: { key: { id: "MSG_REAGIDA" }, text: "" } }),
  evento({ protocolMessage: {} }),
  evento({ conversation: "oi" }, { key: { remoteJid: "123@g.us", id: "x" } }),
  evento({ conversation: "oi" }, { key: { remoteJid: "123@broadcast", id: "x" } }),
  evento({ conversation: "oi" }, { key: { remoteJid: "5511999999999@s.whatsapp.net", id: "x", fromMe: true } }),
  evento({ tipoNuncaVistoAntes: {} }),
  evento({
    ephemeralMessage: { message: { viewOnceMessage: { message: { conversation: "fundo" } } } },
  }),
];

Deno.test("paridade — classificarEventoEvolution idêntico nos dois lados", () => {
  for (const payload of BATERIA) {
    assertEquals(
      classificarEventoEvolution(payload),
      classificarVite(payload),
      `divergência para payload: ${JSON.stringify(payload)}`,
    );
  }
});
