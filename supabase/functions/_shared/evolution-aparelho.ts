// _shared/evolution-aparelho.ts — E02-S39 (ADR-1688). Mensagem enviada pelo próprio número do
// canal (celular, WhatsApp Web, outro aparelho pareado). Vira texto para o histórico: mídia,
// áudio, localização e contato entram como MARCADOR, sem download nem transcrição — transcrever
// gravaria autor `cliente` e acordaria o Zé. Nunca usa `pushName` (é o nome da empresa, não de
// quem digitou).

export const TAMANHO_MAXIMO_DO_TEXTO_DO_APARELHO = 4000;

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/** Mensagens efêmeras, de visualização única e documento com legenda vêm embrulhadas. */
function desembrulhar(mensagem: Record<string, unknown>): Record<string, unknown> {
  for (const involucro of [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
  ]) {
    const interna = objeto(objeto(mensagem[involucro])?.message);
    if (interna !== null) return desembrulhar(interna);
  }
  return mensagem;
}

const MARCADORES: ReadonlyArray<[campo: string, rotulo: string]> = [
  ["audioMessage", "[Áudio enviado pelo aparelho]"],
  ["imageMessage", "[Imagem enviada pelo aparelho]"],
  ["videoMessage", "[Vídeo enviado pelo aparelho]"],
  ["documentMessage", "[Documento enviado pelo aparelho]"],
  ["stickerMessage", "[Figurinha enviada pelo aparelho]"],
  ["locationMessage", "[Localização enviada pelo aparelho]"],
  ["liveLocationMessage", "[Localização enviada pelo aparelho]"],
  ["contactMessage", "[Contato enviado pelo aparelho]"],
  ["contactsArrayMessage", "[Contatos enviados pelo aparelho]"],
];

function truncar(texto: string): string {
  return texto.length <= TAMANHO_MAXIMO_DO_TEXTO_DO_APARELHO
    ? texto
    : `${texto.slice(0, TAMANHO_MAXIMO_DO_TEXTO_DO_APARELHO - 1)}…`;
}

export function textoDoAparelho(mensagemBruta: Record<string, unknown>): string {
  const mensagem = desembrulhar(mensagemBruta);
  if (typeof mensagem.conversation === "string" && mensagem.conversation.trim() !== "") {
    return truncar(mensagem.conversation);
  }
  const estendida = objeto(mensagem.extendedTextMessage);
  if (estendida !== null && typeof estendida.text === "string" && estendida.text.trim() !== "") {
    return truncar(estendida.text);
  }
  for (const [campo, rotulo] of MARCADORES) {
    const conteudo = objeto(mensagem[campo]);
    if (conteudo === null) continue;
    const legenda = typeof conteudo.caption === "string" ? conteudo.caption.trim() : "";
    return truncar(legenda === "" ? rotulo : `${rotulo} ${legenda}`);
  }
  return "[Mensagem enviada pelo aparelho]";
}

/** Segundos desde 1970, número ou texto; inválido fica nulo (o banco usa agora). */
export function horarioDoAparelho(valor: unknown): Date | null {
  const segundos = typeof valor === "string" ? Number(valor) : valor;
  if (typeof segundos !== "number" || !Number.isFinite(segundos) || segundos <= 0) return null;
  return new Date(segundos * 1000);
}
