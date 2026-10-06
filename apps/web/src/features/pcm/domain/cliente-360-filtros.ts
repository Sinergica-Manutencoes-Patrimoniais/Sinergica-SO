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

export type FiltrosSistemas360 = {
  busca: string;
  categoriaIds: readonly string[];
  areaIds: readonly string[];
  localIds: readonly string[];
  composicao: "todos" | "com_itens" | "vazios";
  situacao: "todos" | "ativos" | "inativos";
  syncStatuses: readonly string[];
};

export type SistemaFiltravel360 = {
  id: string;
  nome: string;
  codigo: string | null;
  categoriaId: string | null;
  areaId: string | null;
  localId: string | null;
  ativo: boolean;
  auvoSyncStatus: string | null;
};

export const FILTROS_SISTEMAS_360_VAZIO: FiltrosSistemas360 = {
  busca: "",
  categoriaIds: [],
  areaIds: [],
  localIds: [],
  composicao: "todos",
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

/** Filtros de sistemas; a composição é calculada localmente a partir dos membros já carregados. */
export function filtrarSistemas360<T extends SistemaFiltravel360>(
  sistemas: readonly T[],
  quantidadeMembrosPorSistema: ReadonlyMap<string, number>,
  filtros: FiltrosSistemas360,
): T[] {
  const busca = normalizarBusca360(filtros.busca);
  return sistemas.filter((sistema) => {
    if (busca) {
      const pesquisavel = normalizarBusca360(`${sistema.nome} ${sistema.codigo ?? ""}`);
      if (!pesquisavel.includes(busca)) return false;
    }
    if (!incluiOuVazio(filtros.categoriaIds, sistema.categoriaId)) return false;
    if (!incluiOuVazio(filtros.areaIds, sistema.areaId)) return false;
    if (!incluiOuVazio(filtros.localIds, sistema.localId)) return false;
    const quantidadeMembros = quantidadeMembrosPorSistema.get(sistema.id) ?? 0;
    if (filtros.composicao === "com_itens" && quantidadeMembros === 0) return false;
    if (filtros.composicao === "vazios" && quantidadeMembros > 0) return false;
    if (filtros.situacao === "ativos" && !sistema.ativo) return false;
    if (filtros.situacao === "inativos" && sistema.ativo) return false;
    if (!incluiOuVazio(filtros.syncStatuses, sistema.auvoSyncStatus)) return false;
    return true;
  });
}
