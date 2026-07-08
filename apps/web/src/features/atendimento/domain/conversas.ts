export type StatusConversa = "aberta" | "pendente" | "encerrada";
export type ModoConversa = "auto" | "pausado";

export interface ConversaItem {
  id: string;
  clientId: string | null;
  clienteNome: string | null;
  contatoNome: string | null;
  status: StatusConversa;
  modo: ModoConversa;
  atribuidoA: string | null;
  naoLidas: number;
  ultimaMensagemPreview: string | null;
  ultimaMensagemEm: string | null;
  ordemServicoId: string | null;
  tags: string[];
}

export interface FiltroConversas {
  busca?: string;
  status?: StatusConversa;
}

/** Filtro puro sobre a lista já carregada — sem I/O. Busca casa contra cliente/contato/preview,
 * sem diferenciar maiúsculas/acentos. */
export function filtrarConversas(
  conversas: ConversaItem[],
  filtro: FiltroConversas = {},
): ConversaItem[] {
  const termo = filtro.busca ? normalizar(filtro.busca) : "";
  return conversas.filter((conversa) => {
    if (filtro.status && conversa.status !== filtro.status) return false;
    if (!termo) return true;
    return [conversa.clienteNome, conversa.contatoNome, conversa.ultimaMensagemPreview]
      .filter((valor): valor is string => Boolean(valor))
      .some((valor) => normalizar(valor).includes(termo));
  });
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
