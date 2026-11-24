// application/agenda-projecao-queries.ts — E01-S202.
// Chaves da projeção da Agenda do Técnico. Fica em `application/` (não importa `infrastructure/`,
// regra do dependency-cruiser): quem injeta o fetch é a borda.

export const agendaProjecaoQueryKeys = {
  /** Semana (segunda-feira ISO) × Cliente ("todos" quando não há filtro). */
  semana: (semanaInicio: string, clienteId: string | null) =>
    ["pcm", "agenda-projecao-visita", semanaInicio, clienteId ?? "todos"] as const,
};
