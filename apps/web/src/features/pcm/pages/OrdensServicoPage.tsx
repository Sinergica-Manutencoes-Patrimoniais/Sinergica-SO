import { Button, Modal, Tooltip } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ClipboardList,
  Clock3,
  Expand,
  Headset,
  Kanban,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { useDebouncedValue } from "../../../lib/use-debounced-value";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import { criarChamado } from "../application/chamados";
import { obterPreferenciaColunas, salvarPreferenciaColunas } from "../application/kanban-colunas";
import type { ConsultaOperacao } from "../application/operacao-gateway";
import {
  marcarConteudoPintadoChamados,
  marcarDadosProntosChamados,
  marcarInicioNavegacaoChamados,
} from "../application/operacao-performance";
import {
  OPERACAO_CATALOGO_STALE_TIME,
  OPERACAO_KPI_VAZIO,
  dadosFeedParaOrdens,
  mesclarDetalhe,
  operacaoQueryKeys,
  useAlterarStatusOperacao,
  useDetalheOperacao,
  useFeedOperacao,
  useFeedsKanban,
  useKpisOperacao,
} from "../application/operacao-queries";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import { listarProximasPreventivas } from "../application/pmoc";
import type { PmocPreventivaResumo } from "../application/pmoc-gateway";
import { AbrirOsAuvoModal } from "../components/AbrirOsAuvoModal";
import { ChamadoPainel } from "../components/ChamadoPainel";
import { DetalhesTarefaAuvo } from "../components/DetalhesTarefaAuvo";
import { NovaOrdemServicoModal } from "../components/NovaOrdemServicoModal";
import { NovoChamadoModal } from "../components/NovoChamadoModal";
import { OsCalendarioView } from "../components/OsCalendarioView";
import { OsKanbanView } from "../components/OsKanbanView";
import { OsTimelineView } from "../components/OsTimelineView";
import { CATEGORIAS_OS } from "../domain/abertura-os";
import type { ChamadoFormData } from "../domain/chamados";
import { TIPO_OS_HUB_LABEL, calcularPrioridadeHub } from "../domain/hub-os";
import {
  COLUNAS_KANBAN_PADRAO,
  type ColunaKanbanId,
  type ColunaKanbanPreferencia,
  alternarVisibilidadeColuna,
  moverColuna,
} from "../domain/kanban-colunas";
import type {
  FiltrosOrdens,
  OrdemServicoOperacional,
  StatusOrdemServico,
} from "../domain/ordens-servico";
import {
  FILTROS_ORDENS_VAZIO,
  PRIORIDADE_LABEL,
  STATUS_OS,
  auvoTaskDeepLink,
  calcularKpisOrdens,
  calcularMetricasOperacao,
  ehCardChamadoAberto,
  filtrarOrdens,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloNumeroOrdem,
  rotuloOrigemOs,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseKanbanColunasAdapter } from "../infrastructure/supabase-kanban-colunas-adapter";
import { supabaseOperacaoAdapter } from "../infrastructure/supabase-operacao-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
import { supabasePmocAdapter } from "../infrastructure/supabase-pmoc-adapter";
import { BacklogGutPage } from "./BacklogGutPage";

type Visao = "lista" | "kanban" | "timeline" | "calendario" | "backlog";

const VISOES: Array<{ value: Visao; label: string; Icone: typeof List }> = [
  { value: "lista", label: "Lista", Icone: List },
  { value: "kanban", label: "Kanban", Icone: Kanban },
  { value: "timeline", label: "Timeline", Icone: Clock3 },
  { value: "calendario", label: "Calendário", Icone: Calendar },
  // E01-S118 AC-3: Backlog GUT deixa de ser tela/menu à parte e vira aba (visão priorizada por GUT).
  { value: "backlog", label: "Backlog", Icone: LayoutGrid },
];

function intervaloAgendaInicial() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 41);
  const isoLocal = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  return { inicio: isoLocal(inicio), fim: isoLocal(fim) };
}

export function OrdensServicoPage({
  refreshKey = 0,
  onNovaOs,
  abaInicial,
  osIdInicialToken,
  filtrosIniciais,
}: {
  refreshKey?: number;
  onNovaOs: () => void;
  /** E01-S118: aba inicial (ex.: `view=backlog` do Dashboard abre já na aba Backlog). */
  abaInicial?: Visao;
  /** Formato `${osId}::${seq}` (E01-S49) — `seq` muda a cada clique no cliente-360, mesmo pra
   * mesma OS, forçando o efeito abaixo a reagir mesmo quando o id não muda de valor. */
  osIdInicialToken?: string;
  /** E01-S75 AC-5: semeia os filtros no mount (ex. vindo de "técnico" no Apontamento de Horas) —
   * a página sempre remonta ao navegar pra cá (branch diferente no switch de `pcmView`), então
   * seed-no-mount basta, sem precisar do padrão seq/useEffect do `osIdInicialToken`. */
  filtrosIniciais?: Partial<FiltrosOrdens>;
}) {
  const { user } = useAuth();
  useState(() => marcarInicioNavegacaoChamados());
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [conversaoPendente, setConversaoPendente] = useState<{
    chamadoId: string;
    statusDestino: Exclude<StatusOrdemServico, "solicitacao">;
  } | null>(null);
  // E01-S118 AC-6: incrementa a cada clique de card pra reabrir o modal de detalhe (mesmo card 2x).
  const [modalDetalheSeq, setModalDetalheSeq] = useState(0);
  const [visao, setVisao] = useState<Visao>(abaInicial ?? "lista");
  const [intervaloAgenda, setIntervaloAgenda] = useState(intervaloAgendaInicial);
  const [filtros, setFiltros] = useState<FiltrosOrdens>(() => ({
    ...FILTROS_ORDENS_VAZIO,
    status: "ativos",
    ...filtrosIniciais,
  }));
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState(false);
  const [colunasKanban, setColunasKanban] =
    useState<ColunaKanbanPreferencia[]>(COLUNAS_KANBAN_PADRAO);
  const [preventivas, setPreventivas] = useState<PmocPreventivaResumo[]>([]);
  const [novoChamadoAberto, setNovoChamadoAberto] = useState(false);
  const [aberturaAuvoOsId, setAberturaAuvoOsId] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");
  const buscaDebounced = useDebouncedValue(filtros.busca, 250);
  const consulta = useMemo<ConsultaOperacao>(
    () => ({
      busca: buscaDebounced || undefined,
      status: filtros.status === "todas" ? "todos" : (filtros.status as ConsultaOperacao["status"]),
      tecnicoFuncionarioId:
        filtros.tecnicoFuncionarioId !== "todos" ? filtros.tecnicoFuncionarioId : undefined,
      clienteId: filtros.clienteId !== "todos" ? filtros.clienteId : undefined,
      categoria: filtros.categoria !== "todas" ? filtros.categoria : undefined,
      dataInicio:
        filtros.dataInicio ??
        (visao === "timeline" || visao === "calendario" ? intervaloAgenda.inicio : null),
      dataFim:
        filtros.dataFim ??
        (visao === "timeline" || visao === "calendario" ? intervaloAgenda.fim : null),
      ordem:
        visao === "backlog"
          ? "gutd"
          : visao === "timeline" || visao === "calendario"
            ? "agenda"
            : "recentes",
      limite: visao === "timeline" || visao === "calendario" ? 200 : visao === "kanban" ? 210 : 50,
    }),
    [buscaDebounced, filtros, visao, intervaloAgenda],
  );
  const consultasAtivas = !permissoesCarregando && temLeitura;
  const consultaKpis = useMemo(
    () => ({
      busca: consulta.busca,
      clienteId: consulta.clienteId,
      tecnicoFuncionarioId: consulta.tecnicoFuncionarioId,
      categoria: consulta.categoria,
      dataInicio: consulta.dataInicio,
      dataFim: consulta.dataFim,
    }),
    [consulta],
  );
  const feed = useFeedOperacao(
    supabaseOperacaoAdapter,
    consulta,
    consultasAtivas && visao !== "kanban",
  );
  const feedsKanban = useFeedsKanban(
    supabaseOperacaoAdapter,
    { ...consultaKpis, status: consulta.status },
    consultasAtivas && visao === "kanban",
  );
  const queryKpis = useKpisOperacao(supabaseOperacaoAdapter, consultaKpis, consultasAtivas);
  const queryCatalogos = useQuery({
    queryKey: [...operacaoQueryKeys.catalogos(), "abertura-os"],
    queryFn: () => carregarDadosAberturaOs(supabaseOrdemServicoAdapter),
    enabled: false,
    staleTime: OPERACAO_CATALOGO_STALE_TIME,
  });
  const dadosOs: DadosAberturaOs | null = queryCatalogos.data ?? null;
  const mutacaoStatus = useAlterarStatusOperacao(supabaseOperacaoAdapter);
  const paginasFeed = visao === "kanban" ? feedsKanban.pages : feed.data?.pages;
  const ordensCarregadas = useMemo(() => dadosFeedParaOrdens(paginasFeed), [paginasFeed]);
  const detalhe = useDetalheOperacao(
    supabaseOperacaoAdapter,
    selecionadaId,
    Boolean(selecionadaId),
  );
  const feedPendente = visao === "kanban" ? feedsKanban.isPending : feed.isPending;
  const feedBuscando = visao === "kanban" ? feedsKanban.isFetching : feed.isFetching;
  const feedErro = visao === "kanban" ? feedsKanban.isError : feed.isError;
  const erroFeed = visao === "kanban" ? feedsKanban.error : feed.error;
  const temProximaPagina = visao === "kanban" ? feedsKanban.hasNextPage : feed.hasNextPage;
  const buscandoProximaPagina =
    visao === "kanban" ? feedsKanban.isFetchingNextPage : feed.isFetchingNextPage;
  const recarregando = feedBuscando || queryKpis.isFetching;
  const carregar = useCallback(async () => {
    setErroAcao(null);
    await Promise.all([
      visao === "kanban" ? feedsKanban.refetch() : feed.refetch(),
      queryKpis.refetch(),
    ]);
  }, [visao, feedsKanban.refetch, feed.refetch, queryKpis.refetch]);
  const primeiraPinturaMarcada = useRef(false);
  useEffect(() => {
    if (!paginasFeed || primeiraPinturaMarcada.current) return;
    primeiraPinturaMarcada.current = true;
    marcarDadosProntosChamados();
    requestAnimationFrame(() => marcarConteudoPintadoChamados());
  }, [paginasFeed]);

  async function salvarNovoChamado(dados: ChamadoFormData) {
    if (!user) return;
    await criarChamado(supabaseChamadosAdapter, { ...dados, userId: user.id });
    setNovoChamadoAberto(false);
    await carregar();
  }

  // E01-S44: `carregar` agora muda de identidade a cada troca de filtro (server-side), então este
  // efeito NÃO pode reagir a `carregar` mudar — só a `refreshKey` mudar de verdade (senão duplica o
  // fetch: o efeito acima já dispara pela troca de filtro). `refreshKeyAnteriorRef` detecta a
  // mudança real, independente de `carregar` ter sido recriado por outro motivo.
  const refreshKeyAnteriorRef = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === refreshKeyAnteriorRef.current) return;
    refreshKeyAnteriorRef.current = refreshKey;
    if (refreshKey > 0 && !permissoesCarregando && temLeitura) carregar();
  }, [refreshKey, permissoesCarregando, temLeitura, carregar]);

  // E01-S49: deep-link vindo do cliente-360 — abre o painel de detalhe dessa OS específica
  // independente do filtro ativo (`selecionada` busca no array completo, não no filtrado).
  useEffect(() => {
    const osId = osIdInicialToken?.split("::")[0];
    if (osId) setSelecionadaId(osId);
  }, [osIdInicialToken]);

  // E01-S84 AC-1/AC-2: preferência de colunas do Kanban é por usuário — carrega só quando a visão
  // Kanban é aberta pela primeira vez (lazy, evita round-trip nas outras visões).
  const colunasCarregadasRef = useRef(false);
  useEffect(() => {
    if (visao !== "kanban" || !user?.id || colunasCarregadasRef.current) return;
    colunasCarregadasRef.current = true;
    obterPreferenciaColunas(supabaseKanbanColunasAdapter, user.id)
      .then(setColunasKanban)
      .catch(() => setColunasKanban(COLUNAS_KANBAN_PADRAO));
    listarProximasPreventivas(supabasePmocAdapter)
      .then(setPreventivas)
      .catch(() => setPreventivas([]));
  }, [visao, user?.id]);

  function persistirColunas(proximo: ColunaKanbanPreferencia[]) {
    setColunasKanban(proximo);
    if (user?.id) salvarPreferenciaColunas(supabaseKanbanColunasAdapter, user.id, proximo);
  }

  function onMoverColunaKanban(id: ColunaKanbanId, direcao: "cima" | "baixo") {
    persistirColunas(moverColuna(colunasKanban, id, direcao));
  }

  function onAlternarVisibilidadeColunaKanban(id: ColunaKanbanId) {
    persistirColunas(alternarVisibilidadeColuna(colunasKanban, id));
  }

  // E01-S07: ordenação opcional pela prioridade do Hub (calculada, nunca gravada) — quem não tem
  // tipoOs (melhoria/outro, fora do Hub) fica sempre por último, sem sumir da lista.
  const [ordenarPorHub, setOrdenarPorHub] = useState(false);

  const ordensFiltradas = useMemo(() => {
    const filtrosAplicados = { ...filtros, busca: buscaDebounced };
    const filtradas = filtrarOrdens(ordensCarregadas, filtrosAplicados);
    if (!ordenarPorHub) return filtradas;
    return [...filtradas].sort((a, b) => {
      const prioA = calcularPrioridadeHub(a.tipoOs, a.dataAgendada) ?? Number.POSITIVE_INFINITY;
      const prioB = calcularPrioridadeHub(b.tipoOs, b.dataAgendada) ?? Number.POSITIVE_INFINITY;
      return prioA - prioB;
    });
  }, [ordensCarregadas, filtros, buscaDebounced, ordenarPorHub]);

  const tecnicosDisponiveis = useMemo(() => {
    const porId = new Map<string, string>();
    for (const ordem of ordensCarregadas) {
      if (ordem.tecnicoFuncionarioId) {
        porId.set(ordem.tecnicoFuncionarioId, ordem.tecnicoNome ?? "Técnico");
      }
    }
    return [...porId.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [ordensCarregadas]);

  const selecionada = useMemo(() => {
    const resumo = ordensCarregadas.find((ordem) => ordem.id === selecionadaId) ?? null;
    return resumo ? mesclarDetalhe(resumo, detalhe.data) : null;
  }, [ordensCarregadas, selecionadaId, detalhe.data]);

  const kpis = queryKpis.data ?? OPERACAO_KPI_VAZIO;
  const totalFiltrado = visao === "kanban" ? feedsKanban.total : (feed.data?.pages[0]?.total ?? 0);

  // E01-S118 AC-4: métricas operacionais acionáveis, sobre o conjunto filtrado visível.
  const metricasExtra = useMemo(() => calcularMetricasOperacao(ordensFiltradas), [ordensFiltradas]);

  function limparFiltros() {
    setFiltros({ ...FILTROS_ORDENS_VAZIO, status: "ativos" });
  }

  function onMudarVisao(proxima: Visao) {
    setVisao(proxima);
    setSelecionados(new Set());
  }

  const onIntervaloCalendario = useCallback((inicio: string, fim: string) => {
    setIntervaloAgenda((atual) =>
      atual.inicio === inicio && atual.fim === fim ? atual : { inicio, fim },
    );
  }, []);

  // E01-S118 AC-6: clicar num card (Kanban/Timeline/Calendário) seleciona e abre o modal de detalhe.
  function abrirDetalheCard(id: string) {
    setSelecionadaId(id);
    setModalDetalheSeq((seq) => seq + 1);
  }

  function onToggleSelecionado(id: string) {
    // E01-S118 T7: card sintético de Chamado aberto não entra em seleção em lote (não é OS real).
    if (ehCardChamadoAberto(id)) return;
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  async function onAplicarStatusLote(status: StatusOrdemServico) {
    if (!user || selecionados.size === 0) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const resultado = await mutacaoStatus.mutateAsync({ ids: [...selecionados], status });
      const falhas = resultado.filter((item) => !item.sucesso);
      if (falhas.length > 0) {
        setSelecionados(new Set(falhas.map((f) => f.id)));
        setErroAcao(
          `${falhas.length} OS não atualizada(s): ${falhas
            .map((f) => `${f.id} (${f.erro ?? "erro desconhecido"})`)
            .join(", ")}`,
        );
      } else {
        setSelecionados(new Set());
      }
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível aplicar em lote.");
    } finally {
      setSalvando(false);
    }
  }

  async function onAlterarStatusDe(id: string, status: StatusOrdemServico) {
    if (!user) return;
    if (ehCardChamadoAberto(id)) {
      if (status === "solicitacao") return;
      const chamadoId = id.replace("chamado-aberto:", "");
      setSelecionadaId(id);
      setConversaoPendente({ chamadoId, statusDestino: status });
      return;
    }
    setSalvando(true);
    setErroAcao(null);
    try {
      const [resultado] = await mutacaoStatus.mutateAsync({ ids: [id], status });
      if (!resultado?.sucesso) throw new Error(resultado?.erro ?? "Status não atualizado.");
      // E01-S125: status persiste primeiro; criação Auvo nunca é efeito colateral. Só a
      // transição individual abre a confirmação (lote fica manual, por OS, no detalhe).
      const atual = ordensCarregadas.find((ordem) => ordem.id === id);
      if (status === "planejamento" && atual?.auvoTaskId == null) setAberturaAuvoOsId(id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível alterar status.");
    } finally {
      setSalvando(false);
    }
  }

  function onAlterarStatus(status: StatusOrdemServico) {
    if (!selecionada) return;
    return onAlterarStatusDe(selecionada.id, status);
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-body text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }

  if (feedPendente) {
    return <SkeletonOperacao />;
  }

  if (feedErro && ordensCarregadas.length === 0) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-body text-ink-3 mt-1">
          {erroFeed instanceof Error ? erroFeed.message : "Não foi possível carregar chamados."}
        </p>
        <Button variant="ghost" onClick={carregar} className="mt-4">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-heading font-semibold text-ink">Operação</h2>
          <p className="text-body text-ink-3">
            Chamados e OS — do intake à execução (mesmo item, em fases), com sync Auvo
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recarregando && <span className="text-caption text-ink-3">Atualizando…</span>}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={carregar}
            disabled={recarregando}
          >
            Atualizar
          </Button>
          {temEscrita && (
            <>
              {/* E01-S118 AC-2: "Novo Chamado" é o intake primário — a OS é a evolução dele. */}
              <Button
                variant="primary"
                size="sm"
                icon={<Headset className="h-4 w-4" />}
                onClick={async () => {
                  if (!dadosOs) await queryCatalogos.refetch();
                  setNovoChamadoAberto(true);
                }}
              >
                Novo Chamado
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ClipboardList className="h-4 w-4" />}
                onClick={onNovaOs}
              >
                Nova OS
              </Button>
            </>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erroAcao}
        </div>
      )}
      {feedErro && ordensCarregadas.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-warning bg-warning-soft px-4 py-2 text-body text-warning">
          <span>Não foi possível atualizar. Os dados anteriores foram preservados.</span>
          <Button variant="ghost" size="sm" onClick={carregar}>
            Tentar novamente
          </Button>
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
          {[
            ["Total", kpis.total],
            ["Abertas", kpis.abertas],
            ["Planejamento", kpis.emPlanejamento],
            ["Execução", kpis.emExecucao],
            ["Finalizadas", kpis.finalizadas],
            ["Críticas", kpis.criticas],
          ].map(([label, valor]) => (
            <div key={label} className="rounded-lg border border-line bg-card px-3 py-2">
              <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">
                {label}
              </p>
              <p className="mt-0.5 text-title font-bold leading-none text-ink">{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* E01-S118 AC-4: métricas operacionais acionáveis (gargalos), abaixo dos KPIs de status. */}
      <div className="flex flex-wrap gap-2">
        {[
          ["Backlog", metricasExtra.backlog, "text-info"],
          ["Sem técnico", metricasExtra.semTecnico, "text-warning"],
          ["Sync Auvo c/ erro", metricasExtra.syncAuvoErro, "text-danger"],
        ].map(([label, valor, cor]) => (
          <span
            key={label as string}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-caption font-semibold text-ink-2"
          >
            {label}
            <span className={`font-bold tabular-nums ${cor}`}>{valor}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-line-soft">
        {VISOES.map(({ value, label, Icone }) => (
          <button
            key={value}
            type="button"
            onClick={() => onMudarVisao(value)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-caption font-semibold ${
              visao === value
                ? "border-orange text-ink"
                : "border-transparent text-ink-3 hover:text-ink-2"
            }`}
          >
            <Icone className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* E01-S118 AC-3: aba Backlog reusa a página priorizada por GUT; as demais abas seguem o
          fluxo de filtros/visões da OS. */}
      {visao === "backlog" ? (
        <BacklogGutPage
          ordensControladas={ordensFiltradas}
          onPlanejarControlado={(ordem) => onAlterarStatusDe(ordem.id, "planejamento")}
          onAtualizarControlado={carregar}
          totalControlado={totalFiltrado}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-card p-3 md:grid-cols-6">
            <input
              className="input md:col-span-2"
              placeholder="Buscar por número, cliente ou título"
              value={filtros.busca}
              onChange={(event) => setFiltros((f) => ({ ...f, busca: event.target.value }))}
            />
            <select
              className="input"
              value={filtros.status}
              onChange={(event) => setFiltros((f) => ({ ...f, status: event.target.value }))}
            >
              <option value="ativos">Ativos</option>
              <option value="todas">Todos os status</option>
              {STATUS_OS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filtros.tecnicoFuncionarioId}
              onChange={(event) =>
                setFiltros((f) => ({ ...f, tecnicoFuncionarioId: event.target.value }))
              }
            >
              <option value="todos">Todos os técnicos</option>
              {tecnicosDisponiveis.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nome}
                </option>
              ))}
            </select>
            {/* E01-S118 AC-5: filtro por Cliente. */}
            <select
              className="input"
              aria-label="Filtrar por cliente"
              value={filtros.clienteId}
              onFocus={() => {
                if (!dadosOs) queryCatalogos.refetch();
              }}
              onChange={(event) => setFiltros((f) => ({ ...f, clienteId: event.target.value }))}
            >
              <option value="todos">Todos os clientes</option>
              {(dadosOs?.clientes ?? []).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filtros.categoria}
              onChange={(event) => setFiltros((f) => ({ ...f, categoria: event.target.value }))}
            >
              <option value="todas">Todas as categorias</option>
              {CATEGORIAS_OS.map((categoria) => (
                <option key={categoria.value} value={categoria.value}>
                  {categoria.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="input"
                value={filtros.dataInicio ?? ""}
                onChange={(event) =>
                  setFiltros((f) => ({ ...f, dataInicio: event.target.value || null }))
                }
                aria-label="Data inicial"
              />
              <input
                type="date"
                className="input"
                value={filtros.dataFim ?? ""}
                onChange={(event) =>
                  setFiltros((f) => ({ ...f, dataFim: event.target.value || null }))
                }
                aria-label="Data final"
              />
            </div>
            <button
              type="button"
              onClick={limparFiltros}
              className="md:col-span-6 justify-self-start text-caption font-semibold text-ink-3 hover:text-orange"
            >
              Limpar filtros
            </button>
          </div>

          {temEscrita && selecionados.size > 0 && (visao === "lista" || visao === "kanban") && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange bg-orange-soft px-4 py-3">
              <p className="text-body font-semibold text-warning">
                {selecionados.size} selecionada{selecionados.size > 1 ? "s" : ""}
              </p>
              <select
                className="input h-8 w-auto text-caption"
                disabled={salvando}
                value=""
                onChange={(event) => {
                  if (event.target.value)
                    onAplicarStatusLote(event.target.value as StatusOrdemServico);
                }}
              >
                <option value="">Aplicar status a todas…</option>
                {STATUS_OS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSelecionados(new Set())}
                className="text-caption font-semibold text-warning hover:underline"
              >
                Limpar seleção
              </button>
            </div>
          )}

          {visao !== "lista" && (
            <div className="bg-card rounded-xl border border-line p-4">
              {visao === "kanban" && (
                <OsKanbanView
                  ordens={ordensFiltradas}
                  temEscrita={temEscrita}
                  salvando={salvando}
                  onAlterarStatus={(id, status) => onAlterarStatusDe(id, status)}
                  onSelecionar={abrirDetalheCard}
                  selecionados={selecionados}
                  onToggleSelecionado={onToggleSelecionado}
                  colunas={colunasKanban}
                  onMoverColuna={onMoverColunaKanban}
                  onAlternarVisibilidadeColuna={onAlternarVisibilidadeColunaKanban}
                  preventivas={preventivas}
                />
              )}
              {visao === "timeline" && (
                <OsTimelineView ordens={ordensFiltradas} onSelecionar={abrirDetalheCard} />
              )}
              {visao === "calendario" && (
                <OsCalendarioView
                  ordens={ordensFiltradas}
                  onSelecionar={abrirDetalheCard}
                  onIntervaloChange={onIntervaloCalendario}
                />
              )}
            </div>
          )}

          {visao !== "lista" && selecionada && (
            <section className="bg-card rounded-xl border border-line">
              <DetalheOs
                selecionada={selecionada}
                temEscrita={temEscrita}
                salvando={salvando}
                onAlterarStatus={onAlterarStatus}
                onEditar={() => setEditando(true)}
                dadosOs={dadosOs}
                onRecarregar={carregar}
                onAbrirAuvo={(osId) => setAberturaAuvoOsId(osId ?? selecionada.id)}
                aberturaModalSeq={modalDetalheSeq}
                destinoConversao={
                  selecionada.chamadoId === conversaoPendente?.chamadoId
                    ? conversaoPendente.statusDestino
                    : null
                }
                onConversaoFinalizada={() => setConversaoPendente(null)}
              />
            </section>
          )}

          {visao === "lista" && (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
              <section className="bg-card rounded-xl border border-line overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-line-soft bg-paper px-4 py-2.5">
                  <div>
                    <h3 className="text-caption font-semibold text-ink">Fila de ordens</h3>
                    <p className="text-micro text-ink-3">Selecione uma OS para ver o resumo</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-micro font-semibold text-ink-2">
                      <input
                        type="checkbox"
                        checked={ordenarPorHub}
                        onChange={(e) => setOrdenarPorHub(e.target.checked)}
                        className="h-3.5 w-3.5 accent-orange"
                      />
                      Ordenar por Hub
                    </label>
                    <span className="rounded-full border border-line bg-card px-2 py-0.5 text-micro font-semibold tabular-nums text-ink-2">
                      {ordensFiltradas.length} de {totalFiltrado}
                    </span>
                  </div>
                </div>
                {ordensFiltradas.length === 0 ? (
                  <div className="px-5 py-8 text-body text-ink-3">Nenhuma OS encontrada.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-caption">
                      <thead className="sticky top-0 bg-paper text-micro text-ink-3">
                        <tr className="border-b border-line-soft">
                          {temEscrita && <th className="w-8 px-2 py-2" />}
                          <th className="px-2 py-2 text-left font-semibold">Nº</th>
                          <th className="px-2 py-2 text-left font-semibold">OS</th>
                          <th className="px-2 py-2 text-left font-semibold">Status</th>
                          <th className="px-2 py-2 text-left font-semibold">Prioridade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {ordensFiltradas.map((ordem) => (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: mesmo padrão de linha clicável do BacklogGutPage — checkbox interno já é acessível via teclado.
                          <tr
                            key={ordem.id}
                            onClick={() => setSelecionadaId(ordem.id)}
                            aria-selected={ordem.id === selecionadaId}
                            className={`cursor-pointer border-l-2 ${
                              ordem.id === selecionadaId
                                ? "border-orange bg-line-soft"
                                : "border-transparent hover:bg-line-soft"
                            }`}
                          >
                            {temEscrita && (
                              // biome-ignore lint/a11y/useKeyWithClickEvents: só existe pra impedir o clique no checkbox de também disparar a seleção da linha (checkbox já tem seu próprio onChange).
                              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selecionados.has(ordem.id)}
                                  onChange={() => onToggleSelecionado(ordem.id)}
                                  aria-label={`Selecionar ${ordem.numero}`}
                                  className="h-4 w-4 accent-orange"
                                />
                              </td>
                            )}
                            <td className="px-2 py-2 whitespace-nowrap font-brand tabular-nums text-ink-3">
                              {rotuloNumeroOrdem(ordem)}
                            </td>
                            <td className="px-2 py-2">
                              <Tooltip content={resumoTooltipOrdem(ordem)}>
                                <div className="min-w-[180px]">
                                  <p className="truncate font-semibold text-ink">{ordem.titulo}</p>
                                  <p className="mt-0.5 truncate text-micro text-ink-3">
                                    {ordem.clienteNome} · {ordem.categoria} ·{" "}
                                    {ordem.tecnicoNome ?? "sem técnico"}
                                  </p>
                                  {ordem.tipoOs && (
                                    <div className="mt-1">
                                      <BadgeHubOs
                                        tipoOs={ordem.tipoOs}
                                        dataAgendada={ordem.dataAgendada}
                                      />
                                    </div>
                                  )}
                                </div>
                              </Tooltip>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span
                                className={`rounded-full px-2 py-0.5 text-micro font-semibold ${statusOsColor(ordem.status)}`}
                              >
                                {rotuloStatusOs(ordem.status)}
                              </span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span
                                className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(ordem.prioridade)}`}
                              >
                                {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-line bg-card max-h-[calc(100vh-220px)] overflow-y-auto">
                {selecionada ? (
                  <DetalheOs
                    selecionada={selecionada}
                    temEscrita={temEscrita}
                    salvando={salvando}
                    onAlterarStatus={onAlterarStatus}
                    onEditar={() => setEditando(true)}
                    dadosOs={dadosOs}
                    onRecarregar={carregar}
                    onAbrirAuvo={(osId) => setAberturaAuvoOsId(osId ?? selecionada.id)}
                    destinoConversao={
                      selecionada.chamadoId === conversaoPendente?.chamadoId
                        ? conversaoPendente.statusDestino
                        : null
                    }
                    onConversaoFinalizada={() => setConversaoPendente(null)}
                  />
                ) : (
                  <div className="p-8 text-body text-ink-3">Selecione uma OS.</div>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {temProximaPagina && (
        <button
          type="button"
          onClick={() => (visao === "kanban" ? feedsKanban.fetchNextPage() : feed.fetchNextPage())}
          disabled={buscandoProximaPagina}
          className="btn-secondary self-center"
        >
          {buscandoProximaPagina ? "Carregando…" : "Carregar mais"}
        </button>
      )}

      {editando && selecionada && (
        <NovaOrdemServicoModal
          aberto={editando}
          ordem={selecionada}
          onFechar={() => setEditando(false)}
          onEditada={() => {
            setEditando(false);
            carregar();
          }}
        />
      )}

      {novoChamadoAberto && (
        <NovoChamadoModal
          clientes={dadosOs?.clientes ?? []}
          onCancel={() => setNovoChamadoAberto(false)}
          onSalvar={salvarNovoChamado}
        />
      )}
      {aberturaAuvoOsId && (
        <AbrirOsAuvoModal
          osId={aberturaAuvoOsId}
          onFechar={() => setAberturaAuvoOsId(null)}
          onAberta={carregar}
        />
      )}
    </div>
  );
}

function SkeletonOperacao() {
  return (
    <div className="flex flex-col gap-4" aria-label="Carregando chamados">
      <div className="h-14 animate-pulse rounded-xl bg-line-soft" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        {["total", "abertas", "planejamento", "execucao", "finalizadas", "criticas"].map((id) => (
          <div key={id} className="h-16 animate-pulse rounded-lg bg-line-soft" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-line-soft" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
        <div className="h-[480px] animate-pulse rounded-xl bg-line-soft" />
        <div className="h-[480px] animate-pulse rounded-xl bg-line-soft" />
      </div>
    </div>
  );
}

/** E01-S07: badge do tipo do Hub + prioridade calculada; sinaliza P1 atrasada (risco legal PMOC). */
function BadgeHubOs({
  tipoOs,
  dataAgendada,
}: {
  tipoOs: NonNullable<OrdemServicoOperacional["tipoOs"]>;
  dataAgendada: string | null;
}) {
  const prioridade = calcularPrioridadeHub(tipoOs, dataAgendada);
  const atrasada =
    tipoOs === "P1" && dataAgendada != null && new Date(dataAgendada).getTime() < Date.now();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-micro font-semibold ${
        atrasada ? "bg-danger-line text-danger" : "bg-info-soft text-navy"
      }`}
      title={TIPO_OS_HUB_LABEL[tipoOs]}
    >
      {tipoOs} · P{prioridade}
      {atrasada && " · atrasada"}
    </span>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-2.5 py-2">
      <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-0.5 text-caption font-medium text-ink">{value}</p>
    </div>
  );
}

function DetalheOs({
  selecionada,
  temEscrita,
  salvando,
  onAlterarStatus,
  onEditar,
  dadosOs,
  onRecarregar,
  onAbrirAuvo,
  aberturaModalSeq = 0,
  destinoConversao = null,
  onConversaoFinalizada,
}: {
  selecionada: OrdemServicoOperacional;
  temEscrita: boolean;
  salvando: boolean;
  onAlterarStatus: (status: StatusOrdemServico) => void;
  onEditar: () => void;
  /** E01-S118 T7: clientes/tipos/técnicos pro "Gerar OS" do Chamado vinculado. */
  dadosOs: DadosAberturaOs | null;
  /** E01-S118 T7: refetch do board após uma ação do Chamado (gerar OS, cancelar). */
  onRecarregar: () => void;
  onAbrirAuvo: (osId?: string) => void;
  /** E01-S118 AC-6: clicar num card do Kanban/Timeline/Calendário abre este modal direto. O pai
   * incrementa `aberturaModalSeq` a cada clique (mesmo card duas vezes seguidas ainda reabre). */
  aberturaModalSeq?: number;
  destinoConversao?: Exclude<StatusOrdemServico, "solicitacao"> | null;
  onConversaoFinalizada?: () => void;
}) {
  // E01-S75 AC-2: "Expandir" abre a mesma info + abas ricas do Auvo (questionários/fotos) num
  // modal grande — o painel inline continua compacto (master-detail), o modal é onde dá pra ler
  // com folga. Fecha por Esc, clique fora, ou no X.
  const [expandido, setExpandido] = useState(false);

  // E01-S118 AC-6: abre o modal quando o pai sinaliza um clique de card (seq > 0).
  useEffect(() => {
    if (aberturaModalSeq > 0) setExpandido(true);
  }, [aberturaModalSeq]);

  useEffect(() => {
    if (!expandido) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpandido(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandido]);

  // E01-S118 T7: card sintético de Chamado ainda sem OS — não faz sentido mostrar
  // status/GUT/Auvo/técnico (nada disso existe ainda); só o painel do Chamado (abaixo) importa.
  const ehChamadoSemOs = ehCardChamadoAberto(selecionada.id);

  const corpo = (
    <>
      {!ehChamadoSemOs && (
        <>
          <div className="grid grid-cols-2 gap-2 text-body">
            <Info label="Status" value={rotuloStatusOs(selecionada.status)} />
            <Info
              label="Prioridade"
              value={PRIORIDADE_LABEL[selecionada.prioridade] ?? selecionada.prioridade}
            />
            <Info label="Categoria" value={selecionada.categoria} />
            <Info label="Origem" value={rotuloOrigemOs(selecionada.origem)} />
            <Info label="Solicitante" value={selecionada.solicitante ?? "—"} />
            <Info label="Local" value={selecionada.localDescricao ?? "—"} />
            <Info label="Score GUT" value={String(selecionada.scorePcm)} />
            <Info
              label="Fatores"
              value={`${selecionada.gravidade ?? 1} · ${selecionada.urgencia ?? 1} · ${
                selecionada.tendencia ?? 1
              }`}
            />
            <Info
              label="Auvo"
              value={
                auvoTaskDeepLink(selecionada.auvoTaskId) ? (
                  <a
                    href={auvoTaskDeepLink(selecionada.auvoTaskId) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-orange hover:underline"
                  >
                    Auvo #{selecionada.auvoTaskId}
                  </a>
                ) : (
                  "Sem OS no Auvo"
                )
              }
            />
            <Info
              label="Técnico"
              value={
                selecionada.tecnicoNome ??
                (typeof selecionada.detalhes?.tecnicoNomeAuvo === "string"
                  ? selecionada.detalhes.tecnicoNomeAuvo
                  : "Não atribuído")
              }
            />
            {selecionada.dataAgendada && (
              <Info
                label="Agendada"
                value={new Date(selecionada.dataAgendada).toLocaleString("pt-BR")}
              />
            )}
            {selecionada.checkInAt && (
              <Info
                label="Check-in"
                value={new Date(selecionada.checkInAt).toLocaleString("pt-BR")}
              />
            )}
            {selecionada.checkOutAt && (
              <Info
                label="Check-out"
                value={new Date(selecionada.checkOutAt).toLocaleString("pt-BR")}
              />
            )}
          </div>

          {selecionada.auvoSyncError && (
            <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2">
              <p className="text-micro font-semibold uppercase tracking-wider text-danger">
                Erro Auvo
              </p>
              <p className="mt-1 text-body text-danger">{selecionada.auvoSyncError}</p>
            </div>
          )}

          {temEscrita && selecionada.auvoTaskId == null && (
            <button
              type="button"
              onClick={() => onAbrirAuvo()}
              className="h-8 rounded-md bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-deep"
            >
              Abrir OS Auvo
            </button>
          )}

          {selecionada.detalhes && Object.keys(selecionada.detalhes).length > 0 && (
            <DetalhesTarefaAuvo
              detalhes={selecionada.detalhes}
              checkInAt={selecionada.checkInAt}
              checkOutAt={selecionada.checkOutAt}
            />
          )}

          {temEscrita && (
            <div className="rounded-lg border border-line bg-paper p-2.5">
              <label
                htmlFor="status-os-operacional"
                className="text-caption font-semibold uppercase tracking-wider text-ink-3"
              >
                Alterar status
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  id="status-os-operacional"
                  className="input flex-1"
                  value={selecionada.status}
                  disabled={salvando}
                  onChange={(event) => onAlterarStatus(event.target.value as StatusOrdemServico)}
                >
                  {STATUS_OS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-caption text-ink-3">
                Planejamento não abre task automaticamente. Confirme pelo botão Auvo.
              </p>
            </div>
          )}
        </>
      )}

      {/* E01-S118 T7: Chamado vinculado — histórico (WhatsApp/Zé), datas e ações. O histórico
          continua acessível mesmo depois do Chamado ter virado OS (carrega sempre por chamadoId). */}
      {selecionada.chamadoId && (
        <ChamadoPainel
          chamadoId={selecionada.chamadoId}
          dadosOs={dadosOs}
          temEscrita={temEscrita}
          onMutou={onRecarregar}
          onOsPlanejada={onAbrirAuvo}
          auvoTaskId={selecionada.auvoTaskId}
          destinoConversao={destinoConversao}
          onConversaoFinalizada={onConversaoFinalizada}
        />
      )}
    </>
  );

  return (
    <div>
      <div className="border-b border-line-soft px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-micro font-semibold uppercase tracking-[0.14em] text-ink-3">
            {ehChamadoSemOs ? "Resumo do Chamado" : "Resumo da OS"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="inline-flex items-center gap-1 text-caption font-semibold text-ink-2 hover:text-ink"
              aria-label="Expandir detalhe"
            >
              <Expand className="h-3.5 w-3.5" />
              Expandir
            </button>
            {/* E01-S118 T7: sem OS ainda, "Editar" (campos de OS) não se aplica — a edição do
                Chamado é pelas ações do ChamadoPainel (Gerar OS/Backlog/Cancelar/datas). */}
            {temEscrita && !ehChamadoSemOs && (
              <button
                type="button"
                onClick={onEditar}
                className="text-caption font-semibold text-orange hover:text-orange-deep"
              >
                Editar
              </button>
            )}
          </div>
        </div>
        <Tooltip content="Identificador do Chamado (CH) — a OS é a evolução dele. Sem CH, mostra o ID do Auvo.">
          <p className="mt-1 inline-block text-caption font-brand tabular-nums text-ink-3">
            {rotuloNumeroOrdem(selecionada)}
          </p>
        </Tooltip>
        <h3 className="mt-1 text-heading font-semibold text-ink">{selecionada.titulo}</h3>
        <p className="mt-0.5 text-caption text-ink-3">{selecionada.clienteNome}</p>
        <p className="mt-2 text-caption leading-relaxed text-ink-2">
          {selecionada.descricao?.trim() || "Sem descrição informada para esta OS."}
        </p>
      </div>

      <div className="space-y-3 p-4">{corpo}</div>

      {expandido && (
        <Modal
          open
          onOpenChange={(aberto) => {
            if (!aberto) setExpandido(false);
          }}
          titulo={selecionada.titulo}
          descricao={
            <>
              <Tooltip content="Identificador do Chamado (CH) — a OS é a evolução dele. Sem CH, mostra o ID do Auvo.">
                <span className="inline-block font-brand tabular-nums">
                  {rotuloNumeroOrdem(selecionada)}
                </span>
              </Tooltip>
              {" · "}
              {selecionada.clienteNome}
            </>
          }
          tamanho="lg"
        >
          <div className="flex flex-col gap-3">
            <p className="text-body leading-relaxed text-ink-2">
              {selecionada.descricao?.trim() || "Sem descrição informada para esta OS."}
            </p>
            {corpo}
          </div>
        </Modal>
      )}
    </div>
  );
}
