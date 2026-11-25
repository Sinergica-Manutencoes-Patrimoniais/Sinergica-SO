// instagram-direct.ts — E02-S16/ADR-1700. As duas regras do Direct que não são nossas: elas vêm
// da Meta e valem quer gostemos ou não. Puro, sem I/O.
//
//   1. Janela de 24 h: só dá para escrever para quem escreveu nas últimas 24 h. Fora disso a Meta
//      recusa com `code 10 / subcode 2534022`. A UI avisa ANTES, em vez de registrar uma bolha que
//      nunca vai chegar.
//   2. Texto puro, teto de 1000 bytes UTF-8 (não caracteres — emoji custa 4).

export const LIMITE_DE_BYTES_DO_DIRECT = 1000;
export const JANELA_DO_DIRECT_MS = 24 * 60 * 60 * 1000;

export interface MensagemParaJanela {
  direcao: "entrada" | "saida";
  createdAt: string;
}

export function bytesDoTexto(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

/** `true` quando NÃO há mensagem do contato dentro da janela — inclusive quando a conversa ainda
 * não tem nenhuma mensagem de entrada (caso em que nunca houve janela para começar). */
export function janelaDoDirectFechada(
  mensagens: readonly MensagemParaJanela[],
  agora: Date = new Date(),
): boolean {
  const limite = agora.getTime() - JANELA_DO_DIRECT_MS;
  return !mensagens.some((mensagem) => {
    if (mensagem.direcao !== "entrada") return false;
    const quando = Date.parse(mensagem.createdAt);
    return Number.isFinite(quando) && quando >= limite;
  });
}

/** Valida o texto de uma resposta de Direct. Lança com a frase que o atendente lê — a mesma
 * frase, não uma tradução de código de erro da Meta. */
export function validarTextoDoDirect(texto: string): string {
  const limpo = texto.trim();
  if (limpo === "") throw new Error("Escreva a mensagem antes de enviar.");
  if (bytesDoTexto(limpo) > LIMITE_DE_BYTES_DO_DIRECT) {
    throw new Error(
      `O Direct do Instagram aceita até ${LIMITE_DE_BYTES_DO_DIRECT} bytes — encurte a mensagem.`,
    );
  }
  return limpo;
}
