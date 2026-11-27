/**
 * E01-S204 — definição única de OS aberta (glossário: OS aberta, Pré-chamado, Chamado aberto,
 * Backlog, Demanda em aberto). A contagem oficial é do servidor (`pcm.fn_demanda_em_aberto` e
 * `pcm.fn_contagem_operacional_por_cliente`, migration 1913); este módulo só tipa o resultado e
 * espelha o predicado para quem já tem as OS em memória (Dashboard do PCM).
 */
import { ehOsAberta, ehOsRegistroVisita } from "./ordens-servico";

export interface ContagemOperacional {
  /** OS com Chamado, fora de finalizado/cancelado, sem ponto de visita. Inclui o backlog. */
  osAbertas: number;
  /** OS aberta sem data, sem técnico e sem tarefa Auvo (subconjunto de osAbertas). */
  backlog: number;
  /** OS sem Chamado (PRE-), aguardando "Confirmar chamado". Fora de osAbertas. */
  preChamados: number;
  /** Chamado aberto/demanda que ainda não tem OS. */
  chamadosAbertos: number;
  /** osAbertas + preChamados + chamadosAbertos. */
  demandaEmAberto: number;
}

export const CONTAGEM_OPERACIONAL_VAZIA: ContagemOperacional = {
  osAbertas: 0,
  backlog: 0,
  preChamados: 0,
  chamadosAbertos: 0,
  demandaEmAberto: 0,
};

/** Mesmo predicado de `pcm.fn_classificar_item_operacao` para "OS aberta" (os_aberta + backlog). */
export function ehOsAbertaContavel(ordem: {
  status: string;
  titulo: string;
  chamadoId: string | null;
}): boolean {
  return ehOsAberta(ordem.status) && ordem.chamadoId !== null && !ehOsRegistroVisita(ordem.titulo);
}
