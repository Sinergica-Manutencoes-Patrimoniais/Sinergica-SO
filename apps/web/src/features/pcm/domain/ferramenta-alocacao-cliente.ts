// domain/ferramenta-alocacao-cliente.ts — E01-S106. Ferramenta alocável em um cliente — distinto
// da alocação ferramenta→técnico já existente (E01-S65). Uma alocação ativa por ferramenta.

export interface AlocacaoFerramentaCliente {
  id: string;
  ferramentaId: string;
  ferramentaNome: string;
  clienteId: string;
  clienteNome: string;
  alocadaEm: string;
  devolvidaEm: string | null;
}

/** AC-4: só permite alocar se a ferramenta não tiver alocação ativa no momento (o caller já
 * consultou o estado atual — esta função só decide, não faz I/O). */
export function podeAlocar(alocacaoAtiva: AlocacaoFerramentaCliente | null): boolean {
  return alocacaoAtiva === null;
}
