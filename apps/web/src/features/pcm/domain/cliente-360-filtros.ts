export const SEM_SISTEMA = "sem_sistema" as const;

export type FiltrosComponentes360 = {
  busca: string;
  categoriaIds: readonly string[];
  areaIds: readonly string[];
  localIds: readonly string[];
  sistemaIds: readonly string[];
  situacao: "todos" | "ativos" | "inativos";
  syncStatuses: readonly string[];
};

export type ComponenteFiltravel360 = {
  id: string;
  nome: string;
  identificador: string | null;
  categoriaId: string | null;
  areaId: string | null;
  localId: string | null;
  ativo: boolean;
  auvoSyncStatus: string | null;
};

export const FILTROS_COMPONENTES_360_VAZIO: FiltrosComponentes360 = {
  busca: "",
  categoriaIds: [],
  areaIds: [],
  localIds: [],
  sistemaIds: [],
  situacao: "todos",
  syncStatuses: [],
};

/** Busca tolerante a caixa, diacríticos e separadores usados em identificadores. */
export function normalizarBusca360(valor: string): string {
  return (
    valor
      .normalize("NFD")
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: remove marcas de combinação após NFD.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[’'_-]+/g, " ")
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function incluiOuVazio(valores: readonly string[], valor: string | null): boolean {
  return valores.length === 0 || (valor !== null && valores.includes(valor));
}

/** Critérios distintos se acumulam (AND); opções dentro do mesmo critério são alternativas (OR). */
export function filtrarComponentes360<T extends ComponenteFiltravel360>(
  itens: readonly T[],
  sistemaPorItemId: Readonly<Record<string, string | undefined>>,
  filtros: FiltrosComponentes360,
): T[] {
  const busca = normalizarBusca360(filtros.busca);
  return itens.filter((item) => {
    if (busca) {
      const pesquisavel = normalizarBusca360(`${item.nome} ${item.identificador ?? ""}`);
      if (!pesquisavel.includes(busca)) return false;
    }
    if (!incluiOuVazio(filtros.categoriaIds, item.categoriaId)) return false;
    if (!incluiOuVazio(filtros.areaIds, item.areaId)) return false;
    if (!incluiOuVazio(filtros.localIds, item.localId)) return false;
    if (
      filtros.sistemaIds.length > 0 &&
      !filtros.sistemaIds.some((sistemaId) =>
        sistemaId === SEM_SISTEMA
          ? sistemaPorItemId[item.id] === undefined
          : sistemaPorItemId[item.id] === sistemaId,
      )
    ) {
      return false;
    }
    if (filtros.situacao === "ativos" && !item.ativo) return false;
    if (filtros.situacao === "inativos" && item.ativo) return false;
    if (!incluiOuVazio(filtros.syncStatuses, item.auvoSyncStatus)) return false;
    return true;
  });
}
