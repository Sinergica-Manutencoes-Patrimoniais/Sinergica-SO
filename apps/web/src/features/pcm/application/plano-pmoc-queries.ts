// application/plano-pmoc-queries.ts — E01-S203.
// Chaves das consultas de conversão manual Contrato PMOC → Plano. Fica em `application/` (não
// importa `infrastructure/`, regra do dependency-cruiser): quem injeta o fetch é a borda.

export const planoPmocQueryKeys = {
  /** Contratos PMOC do Cliente que ainda não têm Plano. */
  pendentes: (clienteId: string) => ["pcm", "plano-pmoc", "pendentes", clienteId] as const,
  /** Progresso da conversão do Cliente — invalidada junto com `pendentes` a cada criação. */
  cobertura: (clienteId: string) => ["pcm", "plano-pmoc", "cobertura", clienteId] as const,
};
