import { describe, expect, it } from "vitest";
import { classificarEventosMeta } from "./evento-meta";

function direct(item: Record<string, unknown>, contaId = "17841400000000000") {
  return { object: "instagram", entry: [{ id: contaId, messaging: [item] }] };
}

describe("classificarEventosMeta — Instagram Direct", () => {
  it("classifica mensagem de texto com o IGSID do remetente como identidade da conversa", () => {
    const [evento] = classificarEventosMeta(
      direct({ sender: { id: "123" }, recipient: { id: "17841400000000000" }, message: { mid: "m1", text: "oi" } }),
    );
    expect(evento).toEqual({
      tipo: "texto",
      canal: "instagram",
      contaId: "17841400000000000",
      remoteId: "m1",
      remoteJid: "123",
      contatoNome: null,
      texto: "oi",
    });
  });

  it("corta texto acima de 4000 caracteres em vez de recusar a mensagem", () => {
    const [evento] = classificarEventosMeta(
      direct({ sender: { id: "123" }, message: { mid: "m1", text: "a".repeat(5000) } }),
    );
    expect(evento?.tipo).toBe("texto");
    expect(evento?.tipo === "texto" ? evento.texto.length : 0).toBe(4000);
  });

  it("transforma anexo em aviso de texto, sem baixar nada", () => {
    const [evento] = classificarEventosMeta(
      direct({
        sender: { id: "123" },
        message: { mid: "m1", text: "veja", attachments: [{ type: "image" }] },
      }),
    );
    expect(evento).toMatchObject({ tipo: "aviso", conteudo: "imagem", texto: "[imagem] veja" });
  });

  it("anexo desconhecido ou não suportado vira 'outro', nunca texto do contato", () => {
    const [desconhecido] = classificarEventosMeta(
      direct({ sender: { id: "123" }, message: { mid: "m1", attachments: [{ type: "banana" }] } }),
    );
    const [naoSuportado] = classificarEventosMeta(
      direct({
        sender: { id: "123" },
        message: { mid: "m2", attachments: [{ type: "image", is_unsupported: true }] },
      }),
    );
    expect(desconhecido).toMatchObject({ tipo: "aviso", conteudo: "outro" });
    expect(naoSuportado).toMatchObject({ tipo: "aviso", conteudo: "outro" });
  });

  it("reconhece resposta a story", () => {
    const [evento] = classificarEventosMeta(
      direct({
        sender: { id: "123" },
        message: { mid: "m1", text: "amei", reply_to: { story: { id: "9", url: "x" } } },
      }),
    );
    expect(evento).toMatchObject({ tipo: "aviso", conteudo: "story", texto: "[story] amei" });
  });

  it("eco (is_echo) usa o DESTINATÁRIO como identidade — quem falou foi a empresa", () => {
    const [evento] = classificarEventosMeta(
      direct({
        sender: { id: "17841400000000000" },
        recipient: { id: "123" },
        message: { mid: "m9", text: "respondi pelo app", is_echo: true },
      }),
    );
    expect(evento).toMatchObject({ tipo: "eco", remoteJid: "123", remoteId: "m9" });
  });

  it("mensagem apagada e mensagem sem mid são ignoradas", () => {
    const [apagada] = classificarEventosMeta(
      direct({ sender: { id: "123" }, message: { mid: "m1", is_deleted: true } }),
    );
    const [semMid] = classificarEventosMeta(
      direct({ sender: { id: "123" }, message: { text: "oi" } }),
    );
    expect(apagada).toEqual({ tipo: "ignorar", motivo: "mensagem_apagada" });
    expect(semMid).toEqual({ tipo: "ignorar", motivo: "mensagem_sem_mid" });
  });

  it("remetente que não é id numérico da Meta é recusado, não normalizado", () => {
    const [evento] = classificarEventosMeta(
      direct({ sender: { id: "../../admin" }, message: { mid: "m1", text: "oi" } }),
    );
    expect(evento).toEqual({ tipo: "ignorar", motivo: "mensagem_sem_remetente" });
  });

  it("reação vira evento próprio, com chave de idempotência distinta da mensagem", () => {
    const [evento] = classificarEventosMeta(
      direct({ sender: { id: "123" }, reaction: { mid: "m1", action: "react", emoji: "❤️" } }),
    );
    expect(evento).toMatchObject({ tipo: "reacao", remoteId: "reacao:m1", emoji: "❤️" });
  });

  it("unreact zera o emoji", () => {
    const [evento] = classificarEventosMeta(
      direct({ sender: { id: "123" }, reaction: { mid: "m1", action: "unreact", emoji: "❤️" } }),
    );
    expect(evento).toMatchObject({ tipo: "reacao", emoji: null });
  });

  it("comentário de Instagram continua reconhecido (E02-S17)", () => {
    const [evento] = classificarEventosMeta({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          changes: [{ field: "comments", value: { id: "c1", text: "quero", from: { id: "55" } } }],
        },
      ],
    });
    expect(evento).toMatchObject({ tipo: "comentario", comentarioId: "c1", autorId: "55" });
  });
});

describe("classificarEventosMeta — WhatsApp Cloud e payloads inválidos", () => {
  it("lê mensagem de WhatsApp Cloud em changes[].value.messages[]", () => {
    const [evento] = classificarEventosMeta({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "999",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "5511" },
                contacts: [{ profile: { name: "Ana" } }],
                messages: [{ id: "wam1", from: "5511999990000", type: "text", text: { body: "oi" } }],
              },
            },
          ],
        },
      ],
    });
    expect(evento).toMatchObject({
      tipo: "texto",
      canal: "whatsapp",
      contaId: "5511",
      remoteJid: "5511999990000",
      contatoNome: "Ana",
      texto: "oi",
    });
  });

  it("mídia de WhatsApp Cloud vira aviso com legenda", () => {
    const [evento] = classificarEventosMeta({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "999",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "5511" },
                messages: [
                  { id: "wam2", from: "5511999990000", type: "image", image: { caption: "nota" } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(evento).toMatchObject({ tipo: "aviso", conteudo: "imagem", texto: "[imagem] nota" });
  });

  it("nunca lança: objeto desconhecido, payload nulo e entry vazio viram 'ignorar'", () => {
    expect(classificarEventosMeta(null)).toEqual([{ tipo: "ignorar", motivo: "payload_invalido" }]);
    expect(classificarEventosMeta({ object: "pagamento" })).toEqual([
      { tipo: "ignorar", motivo: "objeto_nao_suportado" },
    ]);
    expect(classificarEventosMeta({ object: "instagram", entry: [] })).toEqual([
      { tipo: "ignorar", motivo: "payload_sem_entry" },
    ]);
  });
});
