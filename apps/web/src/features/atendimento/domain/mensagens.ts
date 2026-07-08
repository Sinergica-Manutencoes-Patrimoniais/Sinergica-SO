export type DirecaoMensagem = "entrada" | "saida";
export type RemetenteTipo = "cliente" | "ze" | "humano" | "agente";
export type StatusEntregaMensagem = "enviando" | "enviado" | "erro";
export type TipoConteudoMensagem =
  | "texto"
  | "sistema"
  | "audio"
  | "midia"
  | "template"
  | "interativa";

export interface MensagemItem {
  id: string;
  conversaId: string;
  direcao: DirecaoMensagem;
  remetenteTipo: RemetenteTipo;
  remetenteId: string | null;
  conteudo: string | null;
  statusEntrega: StatusEntregaMensagem | null;
  erroDetalhe: string | null;
  createdAt: string;
  tipoConteudo: TipoConteudoMensagem;
  midiaUrl: string | null;
  midiaNome: string | null;
  midiaMime: string | null;
  payload: Record<string, unknown>;
}

export interface MensagemRicaInput {
  tipo: Exclude<TipoConteudoMensagem, "texto" | "sistema">;
  texto?: string;
  arquivo?: File;
  templateNome?: string;
  templateIdioma?: string;
  parametros?: string[];
  botoes?: string[];
}

export function validarMensagemRica(
  input: MensagemRicaInput,
  canal: "whatsapp" | "instagram" | "messenger",
): MensagemRicaInput {
  if (canal !== "whatsapp")
    throw new Error("Este tipo de mensagem está disponível apenas no WhatsApp.");
  if ((input.tipo === "audio" || input.tipo === "midia") && !input.arquivo) {
    throw new Error("Selecione ou grave um arquivo.");
  }
  if (input.tipo === "template" && !input.templateNome?.trim()) {
    throw new Error("Selecione um template aprovado.");
  }
  if (input.tipo === "interativa" && (!input.texto?.trim() || !input.botoes?.length)) {
    throw new Error("Mensagem interativa precisa de texto e ao menos um botão.");
  }
  return input;
}

/** Valida o texto de uma mensagem antes de enviar — limite espelha o `check` de `conteudo`
 * implícito (mensagens de WhatsApp não têm limite formal, mas 4000 chars é um teto sensato). */
export function validarTextoMensagem(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Mensagem não pode ser vazia.");
  if (limpo.length > 4000) throw new Error("Mensagem muito longa.");
  return limpo;
}
