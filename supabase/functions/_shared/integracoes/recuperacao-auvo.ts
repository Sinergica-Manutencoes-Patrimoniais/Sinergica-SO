import type { BuscaTarefaPorIdentidade } from "../auvo/reconciliar-task.ts";
import { adaptarBuscaAuvo } from "./busca-auvo-recuperacao.ts";
import { delegarRecuperacao, type IdentidadeRecuperacao, type ResultadoDelegacao,
  type ResultadoProprietario, type SolicitacaoProprietario } from "./delegar-recuperacao.ts";
import type { ResultadoTentativa } from "./politica-recuperacao.ts";

/**
 * O adaptador proprietário autentica e autoriza o ator, obtém fatos atuais e
 * implementa a delegação atômica. Nenhuma implementação de rede é criada aqui.
 */
export type PortaRecuperacaoAuvo = {
  autorizar: (identidade: IdentidadeRecuperacao) => Promise<boolean>;
  contratoComprovado: () => Promise<boolean>;
  buscarIdentidade: (identidade: IdentidadeRecuperacao) => Promise<{
    busca: BuscaTarefaPorIdentidade;
    correspondenciasVerificadas: readonly string[];
  }>;
  tentativa: (identidade: IdentidadeRecuperacao) => Promise<ResultadoTentativa>;
  agora: () => number;
  /** Revalidar ator, Cliente, versão, prova de ausência, prazo e requestId em transação. */
  delegar: (pedido: SolicitacaoProprietario) => Promise<ResultadoProprietario>;
};

/** Sem rota ou agendamento. O proprietário segue responsável pela ausência de efeito e retry. */
export async function recuperarAuvo(
  identidade: IdentidadeRecuperacao,
  porta: PortaRecuperacaoAuvo,
): Promise<ResultadoDelegacao | { estado: "indisponivel" }> {
  if (await porta.autorizar(identidade) !== true || await porta.contratoComprovado() !== true)
    return { estado: "indisponivel" };
  return delegarRecuperacao(identidade, {
    consultar: async (atual) => {
      const resultado = await porta.buscarIdentidade(atual);
      return adaptarBuscaAuvo({ origemId: atual.origemId, versaoOrigem: atual.versaoOrigem }, resultado.busca, resultado.correspondenciasVerificadas);
    },
    tentativa: (atual) => porta.tentativa(atual),
    agora: () => porta.agora(),
    delegarAoProprietario: (pedido) => porta.delegar(pedido),
  });
}
