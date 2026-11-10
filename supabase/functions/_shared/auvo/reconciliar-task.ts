/** Resultado de busca autenticada e paginada por identidade estável da OS. */
export type BuscaTarefaPorIdentidade = {
  completa: boolean;
  identidadeComprovada: boolean;
  candidatos: string[];
};

export type DecisaoBuscaTarefa =
  | { situacao: "ausencia_comprovada" }
  | { situacao: "reconciliacao"; motivo: "busca_inconclusiva" | "multiplos_candidatos" | "candidato_existente"; tarefaId: string | null };

const idValido = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 200 && id.trim() === id;

/**
 * Decide somente a partir da busca fornecida. Não comprova que ela é completa,
 * não vincula candidato e não autoriza retry após um efeito incerto.
 */
export function avaliarBuscaTarefa(busca: BuscaTarefaPorIdentidade): DecisaoBuscaTarefa {
  if (!busca || busca.completa !== true || busca.identidadeComprovada !== true || !Array.isArray(busca.candidatos) ||
    busca.candidatos.some((id) => !idValido(id)) || new Set(busca.candidatos).size !== busca.candidatos.length)
    return { situacao: "reconciliacao", motivo: "busca_inconclusiva", tarefaId: null };
  if (busca.candidatos.length > 1) return { situacao: "reconciliacao", motivo: "multiplos_candidatos", tarefaId: null };
  if (busca.candidatos.length === 1) return { situacao: "reconciliacao", motivo: "candidato_existente", tarefaId: busca.candidatos[0]! };
  return { situacao: "ausencia_comprovada" };
}
