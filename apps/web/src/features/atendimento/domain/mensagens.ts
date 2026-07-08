export type DirecaoMensagem = "entrada" | "saida";
export type RemetenteTipo = "cliente" | "ze" | "humano" | "agente";
export type StatusEntregaMensagem = "enviando" | "enviado" | "erro";

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
}

/** Valida o texto de uma mensagem antes de enviar — limite espelha o `check` de `conteudo`
 * implícito (mensagens de WhatsApp não têm limite formal, mas 4000 chars é um teto sensato). */
export function validarTextoMensagem(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Mensagem não pode ser vazia.");
  if (limpo.length > 4000) throw new Error("Mensagem muito longa.");
  return limpo;
}
