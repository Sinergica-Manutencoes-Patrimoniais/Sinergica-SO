// evento-meta.ts — E02-S16/ADR-1700. Classificação TOTAL de um webhook da Meta (Instagram Direct,
// Messenger e WhatsApp Cloud) em eventos que o Atendimento sabe gravar. Puro: sem I/O, sem
// framework, nunca lança — payload de terceiro é sempre dado, nunca contrato.
//
// Regra herdada do porte (rosefish, spec 039) e mantida aqui: Instagram e Messenger chegam em
// `entry[].messaging[]`; WhatsApp Cloud chega em `entry[].changes[].value.messages[]`. Mídia de
// Direct NÃO é baixada — vira aviso de texto, nunca uma fala inventada do contato.
//
// O ESPELHO Deno deste arquivo é supabase/functions/atendimento-meta-webhook/classificar-meta.ts
// (Deno não importa do bundle Vite). Um teste de paridade compara a saída dos dois.

export type CanalMeta = "whatsapp" | "instagram" | "messenger";

export type ConteudoRecebidoMeta =
  | "imagem"
  | "video"
  | "audio"
  | "documento"
  | "compartilhamento"
  | "story"
  | "outro";

export type EventoMeta =
  | {
      tipo: "texto";
      canal: CanalMeta;
      contaId: string;
      remoteId: string;
      remoteJid: string;
      contatoNome: string | null;
      texto: string;
    }
  | {
      tipo: "aviso";
      canal: CanalMeta;
      contaId: string;
      remoteId: string;
      remoteJid: string;
      contatoNome: string | null;
      conteudo: ConteudoRecebidoMeta;
      texto: string;
    }
  | {
      tipo: "eco";
      canal: CanalMeta;
      contaId: string;
      remoteId: string;
      remoteJid: string;
      texto: string;
    }
  | {
      tipo: "reacao";
      canal: CanalMeta;
      contaId: string;
      remoteId: string;
      remoteJid: string;
      emoji: string | null;
    }
  | {
      tipo: "comentario";
      canal: "instagram";
      contaId: string;
      comentarioId: string;
      autorId: string;
      texto: string;
    }
  | { tipo: "ignorar"; motivo: string };

/** Teto de texto gravado numa mensagem de entrada. Acima disso o resto é descartado, nunca
 * recusado — perder o fim de uma mensagem é melhor que perder a mensagem. */
const LIMITE_DE_TEXTO = 4000;

const AVISO_POR_ANEXO: Record<string, ConteudoRecebidoMeta> = {
  image: "imagem",
  video: "video",
  ig_reel: "video",
  reel: "video",
  audio: "audio",
  file: "documento",
  share: "compartilhamento",
  ig_post: "compartilhamento",
  media: "compartilhamento",
  story_mention: "story",
  story: "story",
  ig_story: "story",
};

const TEXTO_DO_AVISO: Record<ConteudoRecebidoMeta, string> = {
  imagem: "[imagem]",
  video: "[vídeo]",
  audio: "[áudio]",
  documento: "[documento]",
  compartilhamento: "[publicação compartilhada]",
  story: "[story]",
  outro: "Mensagem que o sistema não mostra (abra no app do Instagram)",
};

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

/** Identificador da Meta: só dígitos. Recusa o resto em vez de normalizar — um id que não é
 * numérico não veio da Meta, e aceitar vira chave de conversa inventada. */
function identificador(valor: unknown): string | null {
  return typeof valor === "string" && /^[0-9]{1,64}$/.test(valor) ? valor : null;
}

function remoteId(valor: unknown): string | null {
  return typeof valor === "string" && valor.length >= 1 && valor.length <= 256 ? valor : null;
}

function cortar(valor: string): string {
  return valor.length > LIMITE_DE_TEXTO ? valor.slice(0, LIMITE_DE_TEXTO) : valor;
}

function avisoComLegenda(conteudo: ConteudoRecebidoMeta, legenda: string | null): string {
  const base = TEXTO_DO_AVISO[conteudo];
  return legenda === null ? base : cortar(`${base} ${legenda}`);
}

function canalDoObjeto(object: string): CanalMeta | null {
  if (object === "instagram") return "instagram";
  if (object === "page") return "messenger";
  if (object === "whatsapp_business_account") return "whatsapp";
  return null;
}

function classificarItemDeMensageria(
  canal: Exclude<CanalMeta, "whatsapp">,
  contaId: string,
  bruto: unknown,
): EventoMeta {
  const item = objeto(bruto);
  if (item === null) return { tipo: "ignorar", motivo: "item_invalido" };

  const reacao = objeto(item.reaction);
  if (reacao !== null) {
    const idReagido = remoteId(reacao.mid);
    const autor = identificador(objeto(item.sender)?.id);
    if (idReagido === null || autor === null) {
      return { tipo: "ignorar", motivo: "reacao_sem_identidade" };
    }
    const acao = texto(reacao.action);
    const emoji = acao === "unreact" ? null : (texto(reacao.emoji) ?? null);
    return {
      tipo: "reacao",
      canal,
      contaId,
      remoteId: `reacao:${idReagido}`,
      remoteJid: autor,
      emoji: emoji !== null && emoji.length <= 32 ? emoji : null,
    };
  }

  const mensagem = objeto(item.message);
  if (mensagem === null) return { tipo: "ignorar", motivo: "evento_sem_mensagem" };
  if (mensagem.is_deleted === true) return { tipo: "ignorar", motivo: "mensagem_apagada" };

  const id = remoteId(mensagem.mid);
  if (id === null) return { tipo: "ignorar", motivo: "mensagem_sem_mid" };

  // Eco: a própria conta respondeu pelo app/por outra automação. Quem fala é a empresa, então a
  // identidade da conversa é o DESTINATÁRIO, não o remetente.
  if (mensagem.is_echo === true) {
    const destinatario = identificador(objeto(item.recipient)?.id);
    if (destinatario === null) return { tipo: "ignorar", motivo: "eco_sem_destinatario" };
    return {
      tipo: "eco",
      canal,
      contaId,
      remoteId: id,
      remoteJid: destinatario,
      texto: cortar(texto(mensagem.text) ?? ""),
    };
  }

  const remetente = identificador(objeto(item.sender)?.id);
  if (remetente === null) return { tipo: "ignorar", motivo: "mensagem_sem_remetente" };

  const corpo = texto(mensagem.text);
  const anexos = lista(mensagem.attachments);
  if (anexos.length > 0) {
    const primeiro = objeto(anexos[0]);
    const tipoDeclarado = texto(primeiro?.type) ?? "";
    const conteudo: ConteudoRecebidoMeta =
      primeiro?.is_unsupported === true ? "outro" : (AVISO_POR_ANEXO[tipoDeclarado] ?? "outro");
    return {
      tipo: "aviso",
      canal,
      contaId,
      remoteId: id,
      remoteJid: remetente,
      contatoNome: null,
      conteudo,
      texto: avisoComLegenda(conteudo, corpo),
    };
  }

  // Resposta a story: a Meta manda só o texto da resposta; o story em si nunca vem.
  const story = objeto(objeto(mensagem.reply_to)?.story);
  if (story !== null) {
    return {
      tipo: "aviso",
      canal,
      contaId,
      remoteId: id,
      remoteJid: remetente,
      contatoNome: null,
      conteudo: "story",
      texto: cortar(corpo === null ? "[story] resposta a um story" : `[story] ${corpo}`),
    };
  }

  if (corpo === null) return { tipo: "ignorar", motivo: "mensagem_sem_conteudo" };

  return {
    tipo: "texto",
    canal,
    contaId,
    remoteId: id,
    remoteJid: remetente,
    contatoNome: null,
    texto: cortar(corpo),
  };
}

function textoDaMensagemWhatsApp(mensagem: Record<string, unknown>): string | null {
  const interativa = objeto(mensagem.interactive);
  return (
    texto(objeto(mensagem.text)?.body) ??
    texto(objeto(mensagem.button)?.text) ??
    texto(objeto(interativa?.button_reply)?.title) ??
    texto(objeto(interativa?.list_reply)?.title)
  );
}

const AVISO_POR_TIPO_WHATSAPP: Record<string, ConteudoRecebidoMeta> = {
  image: "imagem",
  video: "video",
  audio: "audio",
  voice: "audio",
  document: "documento",
  sticker: "imagem",
};

function classificarMudancaWhatsApp(contaId: string, bruto: unknown): EventoMeta[] {
  const valor = objeto(objeto(bruto)?.value);
  if (valor === null) return [{ tipo: "ignorar", motivo: "mudanca_sem_valor" }];
  const contaDoNumero = identificador(objeto(valor.metadata)?.phone_number_id) ?? contaId;
  const nome = texto(objeto(objeto(lista(valor.contacts)[0])?.profile)?.name);

  const mensagens = lista(valor.messages);
  if (mensagens.length === 0) return [{ tipo: "ignorar", motivo: "mudanca_sem_mensagem" }];

  return mensagens.map((bruta): EventoMeta => {
    const mensagem = objeto(bruta);
    if (mensagem === null) return { tipo: "ignorar", motivo: "mensagem_invalida" };
    const id = remoteId(mensagem.id);
    const de = identificador(mensagem.from);
    if (id === null || de === null) return { tipo: "ignorar", motivo: "mensagem_sem_identidade" };

    const corpo = textoDaMensagemWhatsApp(mensagem);
    if (corpo !== null) {
      return {
        tipo: "texto",
        canal: "whatsapp",
        contaId: contaDoNumero,
        remoteId: id,
        remoteJid: de,
        contatoNome: nome,
        texto: cortar(corpo),
      };
    }

    const conteudo = AVISO_POR_TIPO_WHATSAPP[texto(mensagem.type) ?? ""];
    if (conteudo === undefined) return { tipo: "ignorar", motivo: "tipo_nao_reconhecido" };
    const legenda = texto(objeto(mensagem[texto(mensagem.type) ?? ""])?.caption);
    return {
      tipo: "aviso",
      canal: "whatsapp",
      contaId: contaDoNumero,
      remoteId: id,
      remoteJid: de,
      contatoNome: nome,
      conteudo,
      texto: avisoComLegenda(conteudo, legenda),
    };
  });
}

function classificarComentario(contaId: string, bruto: unknown): EventoMeta {
  const valor = objeto(objeto(bruto)?.value);
  const comentarioId = texto(valor?.id);
  const autorId = identificador(objeto(valor?.from)?.id);
  if (comentarioId === null) return { tipo: "ignorar", motivo: "comentario_sem_id" };
  return {
    tipo: "comentario",
    canal: "instagram",
    contaId,
    comentarioId,
    autorId: autorId ?? "",
    texto: cortar(texto(valor?.text) ?? ""),
  };
}

/** Classifica o webhook inteiro. Devolve um evento por item do payload, na ordem em que a Meta
 * mandou — inclusive os `ignorar`, para o handler poder responder 200 com o motivo em vez de
 * silêncio. */
export function classificarEventosMeta(payload: unknown): EventoMeta[] {
  const raiz = objeto(payload);
  if (raiz === null) return [{ tipo: "ignorar", motivo: "payload_invalido" }];

  const canal = canalDoObjeto(texto(raiz.object) ?? "");
  if (canal === null) return [{ tipo: "ignorar", motivo: "objeto_nao_suportado" }];

  const entradas = lista(raiz.entry);
  if (entradas.length === 0) return [{ tipo: "ignorar", motivo: "payload_sem_entry" }];

  const eventos: EventoMeta[] = [];
  for (const bruta of entradas) {
    const entrada = objeto(bruta);
    const contaId = identificador(entrada?.id);
    if (entrada === null || contaId === null) {
      eventos.push({ tipo: "ignorar", motivo: "entry_sem_conta" });
      continue;
    }

    if (canal === "whatsapp") {
      for (const mudanca of lista(entrada.changes)) {
        eventos.push(...classificarMudancaWhatsApp(contaId, mudanca));
      }
      continue;
    }

    for (const item of lista(entrada.messaging)) {
      eventos.push(classificarItemDeMensageria(canal, contaId, item));
    }

    if (canal === "instagram") {
      for (const bruto of lista(entrada.changes)) {
        if (texto(objeto(bruto)?.field) !== "comments") continue;
        eventos.push(classificarComentario(contaId, bruto));
      }
    }
  }

  return eventos.length > 0 ? eventos : [{ tipo: "ignorar", motivo: "payload_sem_evento" }];
}
