import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { TipoOsHub } from "../domain/hub-os";
import type {
  KpisOrdensServico,
  OrdemServicoOperacional,
  StatusOrdemServico,
} from "../domain/ordens-servico";
import type {
  ConsultaOperacao,
  CursorOperacao,
  ItemOperacaoResumo,
  OperacaoDetalhe,
  OperacaoGateway,
  PaginaOperacao,
} from "./operacao-gateway";

function consultaSemCursor(input: ConsultaOperacao) {
  const { cursor: _cursor, ...consulta } = input;
  return consulta;
}

export const operacaoQueryKeys = {
  feeds: () => ["operacao", "feed"] as const,
  feed: (input: ConsultaOperacao) => ["operacao", "feed", consultaSemCursor(input)] as const,
  kpis: (input: Omit<ConsultaOperacao, "status" | "limite" | "cursor" | "ordem">) =>
    ["operacao", "kpis", input] as const,
  detalhe: (id: string) => ["operacao", "detalhe", id] as const,
  catalogos: () => ["operacao", "catalogos"] as const,
};

export function resumoParaOrdem(item: ItemOperacaoResumo): OrdemServicoOperacional {
  return {
    id: item.id,
    numero: item.numero,
    titulo: item.titulo,
    descricao: null,
    clienteNome: item.clienteNome,
    categoria: item.categoria,
    status: item.status,
    prioridade: item.prioridade,
    scorePcm: item.scorePcm,
    gravidade: item.gravidade,
    urgencia: item.urgencia,
    tendencia: item.tendencia,
    dorCliente: item.dorCliente,
    observacao: null,
    origemInspecaoItemId: item.origemInspecaoItemId,
    auvoTaskId: item.auvoTaskId,
    auvoSyncStatus: item.auvoSyncStatus,
    auvoSyncError: item.auvoSyncError,
    createdAt: item.createdAt,
    tecnicoFuncionarioId: item.tecnicoFuncionarioId,
    tecnicoNome: item.tecnicoNome,
    dataAgendada: item.dataAgendada,
    checkInAt: item.checkInAt,
    checkOutAt: item.checkOutAt,
    detalhes: item.orientacao ? { orientacao: item.orientacao } : null,
    tipoOs: item.tipoOs as TipoOsHub | null,
    pmocScheduleId: item.pmocScheduleId,
    chamadoId: item.chamadoId,
    localDescricao: null,
    solicitante: null,
    origem: item.origem,
  };
}

export function mesclarDetalhe(
  resumo: OrdemServicoOperacional,
  detalhe: OperacaoDetalhe | undefined,
): OrdemServicoOperacional {
  if (!detalhe) return resumo;
  return { ...resumo, ...detalhe };
}

export function useFeedOperacao(gateway: OperacaoGateway, input: ConsultaOperacao, enabled = true) {
  return useInfiniteQuery({
    queryKey: operacaoQueryKeys.feed(input),
    queryFn: ({ pageParam, signal }) =>
      gateway.listarPagina({ ...input, cursor: pageParam }, signal),
    initialPageParam: null as CursorOperacao | null,
    getNextPageParam: (pagina) => pagina.proximoCursor ?? undefined,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useFeedsKanban(
  gateway: OperacaoGateway,
  input: Omit<ConsultaOperacao, "limite" | "cursor" | "ordem">,
  enabled = true,
) {
  const { status: filtroStatus, ...filtros } = input;
  const base = { ...filtros, ordem: "recentes" as const, limite: 30 };
  const permitido = (status: StatusOrdemServico) =>
    !filtroStatus ||
    filtroStatus === "todos" ||
    (filtroStatus === "ativos" && status !== "finalizado" && status !== "cancelado") ||
    filtroStatus === status;
  const solicitacao = useFeedOperacao(
    gateway,
    { ...base, status: "solicitacao" },
    enabled && permitido("solicitacao"),
  );
  const corretiva = useFeedOperacao(
    gateway,
    { ...base, status: "corretiva" },
    enabled && permitido("corretiva"),
  );
  const backlog = useFeedOperacao(
    gateway,
    { ...base, status: "backlog" },
    enabled && permitido("backlog"),
  );
  const planejamento = useFeedOperacao(
    gateway,
    { ...base, status: "planejamento" },
    enabled && permitido("planejamento"),
  );
  const execucao = useFeedOperacao(
    gateway,
    { ...base, status: "em_execucao" },
    enabled && permitido("em_execucao"),
  );
  const finalizado = useFeedOperacao(
    gateway,
    { ...base, status: "finalizado" },
    enabled && permitido("finalizado"),
  );
  const cancelado = useFeedOperacao(
    gateway,
    { ...base, status: "cancelado" },
    enabled && permitido("cancelado"),
  );
  const consultas = [
    [solicitacao, permitido("solicitacao")],
    [corretiva, permitido("corretiva")],
    [backlog, permitido("backlog")],
    [planejamento, permitido("planejamento")],
    [execucao, permitido("em_execucao")],
    [finalizado, permitido("finalizado")],
    [cancelado, permitido("cancelado")],
  ]
    .filter(([, ativa]) => ativa)
    .map(([query]) => query as typeof solicitacao);
  return {
    pages: consultas.flatMap((query) => query.data?.pages ?? []),
    total: consultas.reduce((total, query) => total + (query.data?.pages[0]?.total ?? 0), 0),
    isPending: consultas.some((query) => query.isPending),
    isFetching: consultas.some((query) => query.isFetching),
    isFetchingNextPage: consultas.some((query) => query.isFetchingNextPage),
    isError: consultas.some((query) => query.isError),
    error: consultas.find((query) => query.error)?.error ?? null,
    hasNextPage: consultas.some((query) => query.hasNextPage),
    refetch: () => Promise.all(consultas.map((query) => query.refetch())),
    fetchNextPage: () =>
      Promise.all(
        consultas.filter((query) => query.hasNextPage).map((query) => query.fetchNextPage()),
      ),
  };
}

export function useKpisOperacao(
  gateway: OperacaoGateway,
  input: Omit<ConsultaOperacao, "status" | "limite" | "cursor" | "ordem">,
  enabled = true,
) {
  return useQuery({
    queryKey: operacaoQueryKeys.kpis(input),
    queryFn: ({ signal }) => gateway.contarKpis(input, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useDetalheOperacao(
  gateway: OperacaoGateway,
  itemId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: operacaoQueryKeys.detalhe(itemId ?? ""),
    queryFn: ({ signal }) => gateway.obterDetalhe(itemId ?? "", signal),
    enabled: enabled && Boolean(itemId),
    staleTime: 2 * 60_000,
  });
}

type SnapshotFeed = Array<
  [readonly unknown[], { pages: PaginaOperacao[]; pageParams: unknown[] } | undefined]
>;

function atualizarStatusNasPaginas(
  atual: { pages: PaginaOperacao[]; pageParams: unknown[] } | undefined,
  ids: Set<string>,
  status: StatusOrdemServico,
) {
  if (!atual) return atual;
  return {
    ...atual,
    pages: atual.pages.map((pagina) => ({
      ...pagina,
      itens: pagina.itens.map((item) => (ids.has(item.id) ? { ...item, status } : item)),
    })),
  };
}

export function useAlterarStatusOperacao(gateway: OperacaoGateway) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: StatusOrdemServico }) =>
      gateway.alterarStatusLote(ids, status),
    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: operacaoQueryKeys.feeds() });
      const snapshot = queryClient.getQueriesData({
        queryKey: operacaoQueryKeys.feeds(),
      }) as SnapshotFeed;
      const conjunto = new Set(ids);
      queryClient.setQueriesData(
        { queryKey: operacaoQueryKeys.feeds() },
        (atual: { pages: PaginaOperacao[]; pageParams: unknown[] } | undefined) =>
          atualizarStatusNasPaginas(atual, conjunto, status),
      );
      return { snapshot, ids };
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
    },
    onSuccess: (resultado, _input, context) => {
      const falhas = new Set(resultado.filter((item) => !item.sucesso).map((item) => item.id));
      if (falhas.size === 0) return;
      for (const [key, anterior] of context?.snapshot ?? []) {
        queryClient.setQueryData(
          key,
          (atual: { pages: PaginaOperacao[]; pageParams: unknown[] } | undefined) => {
            if (!atual || !anterior) return atual;
            const statusAnterior = new Map(
              anterior.pages.flatMap((pagina) =>
                pagina.itens
                  .filter((item) => falhas.has(item.id))
                  .map((item) => [item.id, item.status] as const),
              ),
            );
            return {
              ...atual,
              pages: atual.pages.map((pagina) => ({
                ...pagina,
                itens: pagina.itens.map((item) =>
                  statusAnterior.has(item.id)
                    ? { ...item, status: statusAnterior.get(item.id) ?? item.status }
                    : item,
                ),
              })),
            };
          },
        );
      }
    },
    onSettled: async (_data, _error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: operacaoQueryKeys.feeds() }),
        queryClient.invalidateQueries({ queryKey: ["operacao", "kpis"] }),
        ...input.ids.map((id) =>
          queryClient.invalidateQueries({ queryKey: operacaoQueryKeys.detalhe(id) }),
        ),
      ]);
    },
  });
}

export function dadosFeedParaOrdens(paginas: PaginaOperacao[] | undefined) {
  return paginas?.flatMap((pagina) => pagina.itens.map(resumoParaOrdem)) ?? [];
}

export const OPERACAO_CATALOGO_STALE_TIME = 10 * 60_000;
export const OPERACAO_KPI_VAZIO: KpisOrdensServico = {
  total: 0,
  abertas: 0,
  emPlanejamento: 0,
  emExecucao: 0,
  finalizadas: 0,
  criticas: 0,
};
