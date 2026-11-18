// classificar.ts — E02-S36. ESPELHO de apps/web/src/features/atendimento/domain/evento-evolution.ts
// (Deno não importa do bundle Vite). Um teste de paridade compara a saída dos dois para a mesma
// bateria de payloads — qualquer divergência quebra o teste primeiro.

export type ConteudoDeMidiaEvolution = "imagem" | "video" | "documento" | "figurinha";
export type AvisoEvolution = "localizacao" | "contato" | "enquete" | "outro";

export type EventoClassificado =
  | {
      tipo: "texto";
      remoteJid: string;
      remoteId: string;
      texto: string;
      pushName?: string;
      citacaoRemoteId?: string;
    }
  | {
      tipo: "audio";
      remoteJid: string;
      remoteId: string;
      audio: { mimeType: string; nome: string; duracaoSegundos?: number };
    }
  | {
      tipo: "midia";
      remoteJid: string;
      remoteId: string;
      conteudo: ConteudoDeMidiaEvolution;
      legenda: string | null;
    }
  | { tipo: "aviso"; remoteJid: string; remoteId: string; aviso: AvisoEvolution }
  | { tipo: "reacao"; remoteJid: string; remoteIdReagido: string; emoji: string }
  | { tipo: "aparelho"; remoteJid: string; remoteId: string }
  | { tipo: "ignorar"; motivo: string };

function objeto(valor: unknown): Record<string, unknown> | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

function conteudoDaMensagem(message: Record<string, unknown>): Record<string, unknown> {
  let atual = message;
  for (let i = 0; i < 3; i++) {
    const embrulho =
      objeto(atual.ephemeralMessage) ??
      objeto(atual.documentWithCaptionMessage) ??
      objeto(atual.viewOnceMessage) ??
      objeto(atual.viewOnceMessageV2) ??
      objeto(atual.viewOnceMessageV2Extension);
    const interna = objeto(embrulho?.message);
    if (interna === null) break;
    atual = interna;
  }
  return atual;
}

function textoDaMensagem(mensagem: Record<string, unknown>): string | null {
  if (typeof mensagem.conversation === "string") return mensagem.conversation;
  const estendida = objeto(mensagem.extendedTextMessage);
  if (estendida !== null && typeof estendida.text === "string") return estendida.text;
  return null;
}

const CAMPOS_DE_MIDIA: Array<[string, ConteudoDeMidiaEvolution]> = [
  ["imageMessage", "imagem"],
  ["videoMessage", "video"],
  ["documentMessage", "documento"],
  ["stickerMessage", "figurinha"],
];

function avisoDaMensagem(message: Record<string, unknown>): AvisoEvolution | null {
  if (message.locationMessage !== undefined || message.liveLocationMessage !== undefined) {
    return "localizacao";
  }
  if (message.contactMessage !== undefined || message.contactsArrayMessage !== undefined) {
    return "contato";
  }
  if (
    message.pollCreationMessage !== undefined ||
    message.pollCreationMessageV2 !== undefined ||
    message.pollCreationMessageV3 !== undefined
  ) {
    return "enquete";
  }
  if (message.eventMessage !== undefined || message.productMessage !== undefined) return "outro";
  return null;
}

export function classificarEventoEvolution(payload: unknown): EventoClassificado {
  const raiz = objeto(payload);
  if (raiz === null || typeof raiz.event !== "string") {
    return { tipo: "ignorar", motivo: "payload_invalido" };
  }
  if (raiz.event !== "MESSAGES_UPSERT") {
    return { tipo: "ignorar", motivo: "evento_nao_upsert" };
  }

  const data = objeto(raiz.data);
  const key = data === null ? null : objeto(data.key);
  const bruta = data === null ? null : objeto(data.message);
  if (data === null || key === null || bruta === null) {
    return { tipo: "ignorar", motivo: "payload_invalido" };
  }

  const remoteJid = key.remoteJid;
  const remoteId = key.id;
  if (typeof remoteJid !== "string" || typeof remoteId !== "string") {
    return { tipo: "ignorar", motivo: "payload_invalido" };
  }

  if (key.fromMe === true) return { tipo: "aparelho", remoteJid, remoteId };

  if (remoteJid.endsWith("@g.us")) return { tipo: "ignorar", motivo: "grupo" };
  if (remoteJid.endsWith("@broadcast")) return { tipo: "ignorar", motivo: "status" };
  if (bruta.protocolMessage !== undefined) return { tipo: "ignorar", motivo: "protocolo" };

  if (bruta.reactionMessage !== undefined) {
    const reacao = objeto(bruta.reactionMessage);
    const reagido = texto(objeto(reacao?.key)?.id);
    if (reacao === null || reagido === null) {
      return { tipo: "ignorar", motivo: "reacao_invalida" };
    }
    const emoji = typeof reacao.text === "string" ? reacao.text.trim() : "";
    return { tipo: "reacao", remoteJid, remoteIdReagido: reagido, emoji };
  }

  const message = conteudoDaMensagem(bruta);
  const corpo = textoDaMensagem(message);
  if (corpo !== null) {
    const contexto =
      objeto(objeto(message.extendedTextMessage)?.contextInfo) ?? objeto(data.contextInfo);
    const citacaoRemoteId = texto(contexto?.stanzaId) ?? undefined;
    const pushName = texto(data.pushName) ?? undefined;
    return {
      tipo: "texto",
      remoteJid,
      remoteId,
      texto: corpo,
      ...(pushName !== undefined ? { pushName } : {}),
      ...(citacaoRemoteId !== undefined ? { citacaoRemoteId } : {}),
    };
  }

  const audio = objeto(message.audioMessage);
  if (audio !== null) {
    const mimeOriginal = audio.mimetype ?? audio.mimeType;
    const mimeType = typeof mimeOriginal === "string" ? mimeOriginal : "audio/ogg";
    const nome = typeof audio.fileName === "string" ? audio.fileName : `${remoteId}.ogg`;
    const duracaoSegundos =
      typeof audio.seconds === "number" && Number.isFinite(audio.seconds) && audio.seconds >= 0
        ? Math.ceil(audio.seconds)
        : undefined;
    return {
      tipo: "audio",
      remoteJid,
      remoteId,
      audio: { mimeType, nome, ...(duracaoSegundos !== undefined ? { duracaoSegundos } : {}) },
    };
  }

  for (const [campo, conteudo] of CAMPOS_DE_MIDIA) {
    const dados = objeto(message[campo]);
    if (dados === null) continue;
    const legendaBruta = conteudo === "figurinha" ? null : texto(dados.caption);
    return { tipo: "midia", remoteJid, remoteId, conteudo, legenda: legendaBruta };
  }

  const aviso = avisoDaMensagem(message);
  if (aviso !== null) return { tipo: "aviso", remoteJid, remoteId, aviso };

  return { tipo: "ignorar", motivo: "tipo_desconhecido" };
}
