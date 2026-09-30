// domain/composicao-sistema.ts — E01-S86 AC-1/AC-3.
// UX de compor um Sistema: checkbox + filtro por nome, staged (marca/desmarca em memória, "Salvar"
// persiste tudo de uma vez via diff — menos round-trips que adicionar/remover item a item).

export interface ItemComposicaoSistema {
  id: string;
  nome: string;
  /** E01-S154 AC-4: nome do Sistema ao qual o item já pertence, quando é um Sistema DIFERENTE do
   * que está sendo composto agora — a UI usa isso pra desabilitar o checkbox. */
  sistemaOutroNome?: string | null;
}

/** AC-1: reduz a lista por nome em tempo real — substring, case/acento-insensível o bastante pra
 * uso comum (normaliza só caixa, não remove acento — nomes de item raramente têm variação de
 * acentuação que atrapalhe a busca). */
export function filtrarItensPorNome(
  itens: ItemComposicaoSistema[],
  termo: string,
): ItemComposicaoSistema[] {
  const normalizado = termo.trim().toLowerCase();
  if (!normalizado) return itens;
  return itens.filter((item) => item.nome.toLowerCase().includes(normalizado));
}

export interface DiffComposicaoSistema {
  adicionar: string[];
  remover: string[];
}

/** AC-1/AC-3: computa o que precisa mudar entre a composição atual (vinda do banco) e a seleção
 * marcada na UI — "Salvar" persiste só o diff, não reenvia a composição inteira. */
export function diffComposicaoSistema(
  membrosAtuaisIds: string[],
  selecionadosIds: string[],
): DiffComposicaoSistema {
  const atuais = new Set(membrosAtuaisIds);
  const selecionados = new Set(selecionadosIds);
  return {
    adicionar: selecionadosIds.filter((id) => !atuais.has(id)),
    remover: membrosAtuaisIds.filter((id) => !selecionados.has(id)),
  };
}
