import { describe, expect, it } from "vitest";
import { classificarEventoEvolution } from "./evento-evolution";

interface Extra {
  key?: Record<string, unknown>;
  [outro: string]: unknown;
}

function evento(message: Record<string, unknown>, extra: Extra = {}) {
  const { key: chaveExtra, ...resto } = extra;
  return {
    event: "MESSAGES_UPSERT",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        id: "ABC123",
        fromMe: false,
        ...chaveExtra,
      },
      message,
      ...resto,
    },
  };
}

describe("classificarEventoEvolution — nunca lança exceção", () => {
  const entradasMalformadas = [
    null,
    undefined,
    "",
    42,
    [],
    {},
    { event: 123 },
    { event: "MESSAGES_UPSERT" },
    { event: "MESSAGES_UPSERT", data: null },
    { event: "MESSAGES_UPSERT", data: {} },
    { event: "MESSAGES_UPSERT", data: { key: {} } },
    { event: "MESSAGES_UPSERT", data: { key: { remoteJid: 1, id: 2 }, message: {} } },
  ];
  it.each(entradasMalformadas)("não lança para %j", (entrada) => {
    expect(() => classificarEventoEvolution(entrada)).not.toThrow();
    expect(classificarEventoEvolution(entrada).tipo).toBe("ignorar");
  });
});

describe("classificarEventoEvolution — ignorados explícitos", () => {
  it("evento diferente de MESSAGES_UPSERT", () => {
    const r = classificarEventoEvolution({ event: "CONNECTION_UPDATE", data: {} });
    expect(r).toEqual({ tipo: "ignorar", motivo: "evento_nao_upsert" });
  });

  it("grupo (@g.us)", () => {
    const r = classificarEventoEvolution(
      evento({ conversation: "oi" }, { key: { remoteJid: "123@g.us", id: "x" } }),
    );
    expect(r).toEqual({ tipo: "ignorar", motivo: "grupo" });
  });

  it("broadcast/status", () => {
    const r = classificarEventoEvolution(
      evento({ conversation: "oi" }, { key: { remoteJid: "123@broadcast", id: "x" } }),
    );
    expect(r).toEqual({ tipo: "ignorar", motivo: "status" });
  });

  it("protocolMessage", () => {
    const r = classificarEventoEvolution(evento({ protocolMessage: {} }));
    expect(r).toEqual({ tipo: "ignorar", motivo: "protocolo" });
  });

  it("tipo totalmente desconhecido NUNCA vira texto", () => {
    const r = classificarEventoEvolution(evento({ algumTipoNovoQueNaoExisteAinda: {} }));
    expect(r).toEqual({ tipo: "ignorar", motivo: "tipo_desconhecido" });
  });
});

describe("classificarEventoEvolution — aparelho (fromMe)", () => {
  it("fromMe true vira aparelho mesmo em grupo/broadcast (checado antes)", () => {
    const r = classificarEventoEvolution(
      evento(
        { conversation: "oi" },
        { key: { remoteJid: "5511999999999@s.whatsapp.net", id: "x", fromMe: true } },
      ),
    );
    expect(r.tipo).toBe("aparelho");
  });
});

describe("classificarEventoEvolution — texto", () => {
  it("conversation simples", () => {
    const r = classificarEventoEvolution(evento({ conversation: "Oi, tudo bem?" }));
    expect(r).toMatchObject({ tipo: "texto", texto: "Oi, tudo bem?" });
  });

  it("extendedTextMessage", () => {
    const r = classificarEventoEvolution(evento({ extendedTextMessage: { text: "resposta" } }));
    expect(r).toMatchObject({ tipo: "texto", texto: "resposta" });
  });

  it("citação dentro de extendedTextMessage.contextInfo", () => {
    const r = classificarEventoEvolution(
      evento({ extendedTextMessage: { text: "esse valor?", contextInfo: { stanzaId: "MSG1" } } }),
    );
    expect(r).toMatchObject({ tipo: "texto", citacaoRemoteId: "MSG1" });
  });

  it("citação em data.contextInfo (Evolution 2)", () => {
    const r = classificarEventoEvolution(
      evento({ conversation: "esse valor?" }, { contextInfo: { stanzaId: "MSG2" } }),
    );
    expect(r).toMatchObject({ tipo: "texto", citacaoRemoteId: "MSG2" });
  });

  it("pushName capturado quando presente", () => {
    const r = classificarEventoEvolution(evento({ conversation: "oi" }, { pushName: "Maria" }));
    expect(r).toMatchObject({ tipo: "texto", pushName: "Maria" });
  });
});

describe("classificarEventoEvolution — áudio", () => {
  it("audioMessage", () => {
    const r = classificarEventoEvolution(
      evento({ audioMessage: { mimetype: "audio/ogg; codecs=opus", seconds: 12.4 } }),
    );
    expect(r).toMatchObject({ tipo: "audio", audio: { duracaoSegundos: 13 } });
  });
});

describe("classificarEventoEvolution — mídia", () => {
  it("imagem com legenda", () => {
    const r = classificarEventoEvolution(evento({ imageMessage: { caption: "foto" } }));
    expect(r).toEqual({
      tipo: "midia",
      remoteJid: "5511999999999@s.whatsapp.net",
      remoteId: "ABC123",
      conteudo: "imagem",
      legenda: "foto",
    });
  });

  it("vídeo sem legenda", () => {
    const r = classificarEventoEvolution(evento({ videoMessage: {} }));
    expect(r).toMatchObject({ tipo: "midia", conteudo: "video", legenda: null });
  });

  it("documento", () => {
    const r = classificarEventoEvolution(evento({ documentMessage: { caption: "laudo" } }));
    expect(r).toMatchObject({ tipo: "midia", conteudo: "documento", legenda: "laudo" });
  });

  it("figurinha NUNCA tem legenda, mesmo se o campo existir", () => {
    const r = classificarEventoEvolution(evento({ stickerMessage: { caption: "ignorado" } }));
    expect(r).toMatchObject({ tipo: "midia", conteudo: "figurinha", legenda: null });
  });
});

describe("classificarEventoEvolution — aviso", () => {
  it.each([
    ["locationMessage", "localizacao"],
    ["liveLocationMessage", "localizacao"],
    ["contactMessage", "contato"],
    ["contactsArrayMessage", "contato"],
    ["pollCreationMessage", "enquete"],
    ["pollCreationMessageV2", "enquete"],
    ["pollCreationMessageV3", "enquete"],
    ["eventMessage", "outro"],
    ["productMessage", "outro"],
  ])("%s vira aviso %s", (campo, aviso) => {
    const r = classificarEventoEvolution(evento({ [campo]: {} }));
    expect(r).toMatchObject({ tipo: "aviso", aviso });
  });
});

describe("classificarEventoEvolution — reação", () => {
  it("emoji presente", () => {
    const r = classificarEventoEvolution(
      evento({ reactionMessage: { key: { id: "MSG_REAGIDA" }, text: "👍" } }),
    );
    expect(r).toEqual({
      tipo: "reacao",
      remoteJid: "5511999999999@s.whatsapp.net",
      remoteIdReagido: "MSG_REAGIDA",
      emoji: "👍",
    });
  });

  it("emoji vazio é remoção, não erro", () => {
    const r = classificarEventoEvolution(
      evento({ reactionMessage: { key: { id: "MSG_REAGIDA" }, text: "" } }),
    );
    expect(r).toMatchObject({ tipo: "reacao", emoji: "" });
  });

  it("reação sem id reagido é ignorada", () => {
    const r = classificarEventoEvolution(evento({ reactionMessage: { key: {}, text: "👍" } }));
    expect(r).toEqual({ tipo: "ignorar", motivo: "reacao_invalida" });
  });
});

describe("classificarEventoEvolution — desembrulho aninhado", () => {
  it("ephemeralMessage > viewOnceMessage > conversation (3 níveis)", () => {
    const r = classificarEventoEvolution(
      evento({
        ephemeralMessage: {
          message: { viewOnceMessage: { message: { conversation: "oi do fundo" } } },
        },
      }),
    );
    expect(r).toMatchObject({ tipo: "texto", texto: "oi do fundo" });
  });

  it("documentWithCaptionMessage desembrulha para documentMessage", () => {
    const r = classificarEventoEvolution(
      evento({
        documentWithCaptionMessage: { message: { documentMessage: { caption: "laudo" } } },
      }),
    );
    expect(r).toMatchObject({ tipo: "midia", conteudo: "documento" });
  });
});
