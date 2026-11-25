import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classificarEventosMeta } from "./classificar-meta.ts";
// Lado Vite — Deno importa por path relativo porque o arquivo é puro TS sem import algum.
import { classificarEventosMeta as classificarVite } from "../../../apps/web/src/features/atendimento/domain/evento-meta.ts";

const BATERIA: unknown[] = [
  null,
  { object: "pagamento" },
  { object: "instagram", entry: [] },
  { object: "instagram", entry: [{ id: "nao-numerico", messaging: [] }] },
  {
    object: "instagram",
    entry: [
      {
        id: "17841400000000000",
        messaging: [{ sender: { id: "123" }, message: { mid: "m1", text: "oi" } }],
      },
    ],
  },
  {
    object: "instagram",
    entry: [
      {
        id: "17841400000000000",
        messaging: [
          {
            sender: { id: "123" },
            message: { mid: "m2", text: "veja", attachments: [{ type: "ig_reel" }] },
          },
          {
            sender: { id: "17841400000000000" },
            recipient: { id: "123" },
            message: { mid: "m3", text: "ok", is_echo: true },
          },
          { sender: { id: "123" }, reaction: { mid: "m1", action: "react", emoji: "❤️" } },
          { sender: { id: "123" }, message: { mid: "m4", text: "amei", reply_to: { story: { id: "9" } } } },
          { sender: { id: "123" }, message: { mid: "m5", is_deleted: true } },
        ],
        changes: [{ field: "comments", value: { id: "c1", text: "quero", from: { id: "55" } } }],
      },
    ],
  },
  {
    object: "page",
    entry: [{ id: "900", messaging: [{ sender: { id: "77" }, message: { mid: "p1", text: "olá" } }] }],
  },
  {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "999",
        changes: [
          {
            value: {
              metadata: { phone_number_id: "5511" },
              contacts: [{ profile: { name: "Ana" } }],
              messages: [
                { id: "wam1", from: "5511999990000", type: "text", text: { body: "oi" } },
                { id: "wam2", from: "5511999990000", type: "image", image: { caption: "nota" } },
                { id: "wam3", from: "5511999990000", type: "sei_la" },
              ],
            },
          },
        ],
      },
    ],
  },
];

Deno.test("classificar-meta: espelho Deno e domínio Vite concordam em toda a bateria", () => {
  for (const payload of BATERIA) {
    assertEquals(classificarEventosMeta(payload), classificarVite(payload));
  }
});

Deno.test("classificar-meta: nunca lança para payload hostil", () => {
  for (const payload of [undefined, 0, "", [], { object: "instagram", entry: [{}] }, { entry: null }]) {
    classificarEventosMeta(payload);
  }
});

Deno.test("classificar-meta: Direct de texto resolve a identidade pelo IGSID do remetente", () => {
  const eventos = classificarEventosMeta({
    object: "instagram",
    entry: [
      {
        id: "17841400000000000",
        messaging: [{ sender: { id: "123" }, message: { mid: "m1", text: "oi" } }],
      },
    ],
  });
  assertEquals(eventos.length, 1);
  assertEquals(eventos[0], {
    tipo: "texto",
    canal: "instagram",
    contaId: "17841400000000000",
    remoteId: "m1",
    remoteJid: "123",
    contatoNome: null,
    texto: "oi",
  });
});
