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
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { Tooltip } from "../../../components/ui/Tooltip";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import { criarChamado, listarChamados } from "../application/chamados";
import {
  alterarStatusEmLote,
  alterarStatusOrdemServico,
  contarKpisOrdens,
  listarOrdensServico,
} from "../application/hub-os";
import type { FiltrosServidorOrdens } from "../application/hub-os-gateway";
import { obterPreferenciaColunas, salvarPreferenciaColunas } from "../application/kanban-colunas";
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
import type { Chamado, ChamadoFormData } from "../domain/chamados";
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
  KpisOrdensServico,
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
  chamadoAbertoParaCard,
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
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabaseKanbanColunasAdapter } from "../infrastructure/supabase-kanban-colunas-adapter";
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

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; ordens: OrdemServicoOperacional[] };

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
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [conversaoPendente, setConversaoPendente] = useState<{
    chamadoId: string;
    statusDestino: Exclude<StatusOrdemServico, "solicitacao">;
  } | null>(null);
  // E01-S118 AC-6: incrementa a cada clique de card pra reabrir o modal de detalhe (mesmo card 2x).
  const [modalDetalheSeq, setModalDetalheSeq] = useState(0);
  const [visao, setVisao] = useState<Visao>(abaInicial ?? "lista");
  const [filtros, setFiltros] = useState<FiltrosOrdens>(() =>
    filtrosIniciais ? { ...FILTROS_ORDENS_VAZIO, ...filtrosIniciais } : FILTROS_ORDENS_VAZIO,
  );
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [recarregando, setRecarregando] = useState(false);
  const [kpisServidor, setKpisServidor] = useState<KpisOrdensServico | null>(null);
  const [editando, setEditando] = useState(false);
  const [colunasKanban, setColunasKanban] =
    useState<ColunaKanbanPreferencia[]>(COLUNAS_KANBAN_PADRAO);
  const [preventivas, setPreventivas] = useState<PmocPreventivaResumo[]>([]);
  // E01-S118 AC-2/AC-5: clientes pro "Novo Chamado" e pro filtro por Cliente do board.
  const [dadosOs, setDadosOs] = useState<DadosAberturaOs | null>(null);
  const [novoChamadoAberto, setNovoChamadoAberto] = useState(false);
  const [aberturaAuvoOsId, setAberturaAuvoOsId] = useState<string | null>(null);
  // E01-S118 T7: Chamados abertos ainda sem OS — exibidos como cards sintéticos na coluna
  // Solicitação (senão um Chamado recém-criado só apareceria no board depois de "Gerar OS").
  const [chamadosAbertos, setChamadosAbertos] = useState<Chamado[]>([]);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  // E01-S44: status/técnico/categoria/data são empurrados pro WHERE do servidor (não busca livre —
  // depende do nome do cliente, só existe depois do JOIN em memória). Sentinelas "todas"/"todos"
  // viram `undefined` (sem filtro).
  const filtrosServidor = useMemo<FiltrosServidorOrdens>(
    () => ({
      status: filtros.status !== "todas" ? filtros.status : undefined,
      tecnicoFuncionarioId:
        filtros.tecnicoFuncionarioId !== "todos" ? filtros.tecnicoFuncionarioId : undefined,
      clienteId: filtros.clienteId !== "todos" ? filtros.clienteId : undefined,
      categoria: filtros.categoria !== "todas" ? filtros.categoria : undefined,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
    }),
    [
      filtros.status,
      filtros.tecnicoFuncionarioId,
      filtros.clienteId,
      filtros.categoria,
      filtros.dataInicio,
      filtros.dataFim,
    ],
  );

  const carregar = useCallback(async () => {
    // Só mostra o spinner de página inteira na primeira carga — refetch por filtro mantém a tela
    // (filtros/KPIs/abas) visível, só acende `recarregando` (sem isso, trocar um select apagava a
    // tela toda a cada clique).
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    setRecarregando(true);
    setErroAcao(null);
    setSelecionados(new Set());
    try {
      const [ordens, kpis, chamadosAbertosLista] = await Promise.all([
        listarOrdensServico(supabaseHubOsAdapter, filtrosServidor),
        contarKpisOrdens(supabaseHubOsAdapter, filtrosServidor),
        listarChamados(supabaseChamadosAdapter, {
          status: "aberto",
          clienteId: filtrosServidor.clienteId,
        }),
      ]);
      setEstado({ fase: "pronto", ordens });
      setKpisServidor(kpis);
      setChamadosAbertos(chamadosAbertosLista);
      setSelecionadaId((atual) => atual ?? ordens[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar OS.",
      });
    } finally {
      setRecarregando(false);
    }
  }, [filtrosServidor]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  // E01-S118: clientes carregados de antemão (seletor do "Novo Chamado" e filtro por Cliente).
  useEffect(() => {
    if (!permissoesCarregando && temLeitura && !dadosOs) {
      carregarDadosAberturaOs(supabaseOrdemServicoAdapter)
        .then(setDadosOs)
        .catch(() => undefined);
    }
  }, [permissoesCarregando, temLeitura, dadosOs]);

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

  // E01-S118 T7: Chamados abertos (ainda sem OS) viram cards sintéticos na coluna Solicitação —
  // resolve o nome do cliente via `dadosOs` (mesma fonte do seletor de "Novo Chamado"/filtro).
  const cardsChamadosAbertos = useMemo(() => {
    const nomesClientes = new Map((dadosOs?.clientes ?? []).map((c) => [c.id, c.nome]));
    return chamadosAbertos.map((chamado) =>
      chamadoAbertoParaCard(chamado, nomesClientes.get(chamado.clienteId) ?? "Cliente"),
    );
  }, [chamadosAbertos, dadosOs]);

  const ordensFiltradas = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const todas = [...estado.ordens, ...cardsChamadosAbertos];
    const filtradas = filtrarOrdens(todas, filtros);
    if (!ordenarPorHub) return filtradas;
    return [...filtradas].sort((a, b) => {
      const prioA = calcularPrioridadeHub(a.tipoOs, a.dataAgendada) ?? Number.POSITIVE_INFINITY;
      const prioB = calcularPrioridadeHub(b.tipoOs, b.dataAgendada) ?? Number.POSITIVE_INFINITY;
      return prioA - prioB;
    });
  }, [estado, cardsChamadosAbertos, filtros, ordenarPorHub]);

  const tecnicosDisponiveis = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const porId = new Map<string, string>();
    for (const ordem of estado.ordens) {
      if (ordem.tecnicoFuncionarioId) {
        porId.set(ordem.tecnicoFuncionarioId, ordem.tecnicoNome ?? "Técnico");
      }
    }
    return [...porId.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [estado]);

  const selecionada = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return (
      estado.ordens.find((ordem) => ordem.id === selecionadaId) ??
      cardsChamadosAbertos.find((card) => card.id === selecionadaId) ??
      null
    );
  }, [estado, cardsChamadosAbertos, selecionadaId]);

  // E01-S44: com busca livre ativa, os KPIs do servidor não sabem do refinamento por nome de
  // cliente (só existe em memória) — cai pro cálculo client-side sobre o que já está carregado,
  // pra continuar batendo com a lista visível (mesma garantia da E01-S42).
  const kpis = useMemo(() => {
    // E01-S118: o RPC de KPIs não tem filtro por cliente — com busca livre OU filtro de Cliente
    // ativo, calcula client-side em cima do conjunto já filtrado (bate com a lista visível).
    if (filtros.busca.trim().length > 0 || filtros.clienteId !== "todos") {
      return calcularKpisOrdens(ordensFiltradas);
    }
    return kpisServidor ?? calcularKpisOrdens(ordensFiltradas);
  }, [filtros.busca, filtros.clienteId, ordensFiltradas, kpisServidor]);

  // E01-S118 AC-4: métricas operacionais acionáveis, sobre o conjunto filtrado visível.
  const metricasExtra = useMemo(() => calcularMetricasOperacao(ordensFiltradas), [ordensFiltradas]);

  function limparFiltros() {
    setFiltros(FILTROS_ORDENS_VAZIO);
  }

  function onMudarVisao(proxima: Visao) {
    setVisao(proxima);
    setSelecionados(new Set());
  }

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
      const resultado = await alterarStatusEmLote(
        supabaseHubOsAdapter,
        [...selecionados],
        status,
        user.id,
      );
      if (estado.fase === "pronto") {
        const sucesso = new Set(resultado.sucesso);
        setEstado({
          fase: "pronto",
          ordens: estado.ordens.map((ordem) =>
            sucesso.has(ordem.id) ? { ...ordem, status } : ordem,
          ),
        });
      }
      if (resultado.falhas.length > 0) {
        setSelecionados(new Set(resultado.falhas.map((f) => f.id)));
        setErroAcao(
          `${resultado.falhas.length} OS não atualizada(s): ${resultado.falhas
            .map((f) => `${f.id} (${f.erro})`)
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
      const atualizada = await alterarStatusOrdemServico(supabaseHubOsAdapter, {
        id,
        status,
        updatedBy: user.id,
      });
      if (estado.fase === "pronto") {
        setEstado({
          fase: "pronto",
          ordens: estado.ordens.map((ordem) =>
            ordem.id === atualizada.id ? { ...ordem, ...atualizada } : ordem,
          ),
        });
      }
      // E01-S125: status persiste primeiro; criação Auvo nunca é efeito colateral. Só a
      // transição individual abre a confirmação (lote fica manual, por OS, no detalhe).
      if (status === "planejamento" && atualizada.auvoTaskId == null) setAberturaAuvoOsId(id);
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
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando ordens…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Operação</h2>
          <p className="text-sm text-ink-3">
            Chamados e OS — do intake à execução (mesmo item, em fases), com sync Auvo
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recarregando && <span className="text-xs text-ink-3">Atualizando…</span>}
          <button
            type="button"
            onClick={carregar}
            disabled={recarregando}
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <>
              {/* E01-S118 AC-2: "Novo Chamado" é o intake primário — a OS é a evolução dele. */}
              <button
                type="button"
                onClick={() => setNovoChamadoAberto(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
              >
                <Headset className="h-4 w-4" />
                Novo Chamado
              </button>
              <button
                type="button"
                onClick={onNovaOs}
                className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
              >
                <ClipboardList className="h-4 w-4" />
                Nova OS
              </button>
            </>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
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
            <div key={label} className="rounded-[8px] border border-line bg-card px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {label}
              </p>
              <p className="mt-0.5 text-xl font-bold leading-none text-ink">{valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* E01-S118 AC-4: métricas operacionais acionáveis (gargalos), abaixo dos KPIs de status. */}
      <div className="flex flex-wrap gap-2">
        {[
          ["Backlog", metricasExtra.backlog, "text-[#6B3FA0]"],
          ["Sem técnico", metricasExtra.semTecnico, "text-[#B26A00]"],
          ["Sync Auvo c/ erro", metricasExtra.syncAuvoErro, "text-[#C5362B]"],
        ].map(([label, valor, cor]) => (
          <span
            key={label as string}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-ink-2"
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
            className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-semibold ${
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
        <BacklogGutPage />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 rounded-[10px] border border-line bg-card p-3 md:grid-cols-6">
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
              className="md:col-span-6 justify-self-start text-xs font-semibold text-ink-3 hover:text-orange"
            >
              Limpar filtros
            </button>
          </div>

          {temEscrita && selecionados.size > 0 && (visao === "lista" || visao === "kanban") && (
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-orange bg-orange-soft px-4 py-3">
              <p className="text-sm font-semibold text-[#7A3F00]">
                {selecionados.size} selecionada{selecionados.size > 1 ? "s" : ""}
              </p>
              <select
                className="input h-8 w-auto text-xs"
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
                className="text-xs font-semibold text-[#7A3F00] hover:underline"
              >
                Limpar seleção
              </button>
            </div>
          )}

          {visao !== "lista" && (
            <div className="bg-card rounded-[10px] border border-line p-4">
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
                <OsCalendarioView ordens={ordensFiltradas} onSelecionar={abrirDetalheCard} />
              )}
            </div>
          )}

          {visao !== "lista" && selecionada && (
            <section className="bg-card rounded-[10px] border border-line">
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
              <section className="bg-card rounded-[10px] border border-line overflow-hidden max-h-[calc(100vh-220px)] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-line-soft bg-paper px-4 py-2.5">
                  <div>
                    <h3 className="text-xs font-semibold text-ink">Fila de ordens</h3>
                    <p className="text-[11px] text-ink-3">Selecione uma OS para ver o resumo</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
                      <input
                        type="checkbox"
                        checked={ordenarPorHub}
                        onChange={(e) => setOrdenarPorHub(e.target.checked)}
                        className="h-3.5 w-3.5 accent-orange"
                      />
                      Ordenar por Hub
                    </label>
                    <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-2">
                      {ordensFiltradas.length}
                    </span>
                  </div>
                </div>
                {ordensFiltradas.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS encontrada.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-paper text-[11px] text-ink-3">
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
                                  <p className="mt-0.5 truncate text-[11px] text-ink-3">
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
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusOsColor(ordem.status)}`}
                              >
                                {rotuloStatusOs(ordem.status)}
                              </span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
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

              <section className="rounded-[10px] border border-line bg-card max-h-[calc(100vh-220px)] overflow-y-auto">
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
                  <div className="p-8 text-sm text-ink-3">Selecione uma OS.</div>
                )}
              </section>
            </div>
          )}
        </>
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
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        atrasada ? "bg-[#FDECEB] text-[#B42318]" : "bg-[#EEF2FF] text-navy"
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
    <div className="rounded-[7px] border border-line bg-paper px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-ink">{value}</p>
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
          <div className="grid grid-cols-2 gap-2 text-sm">
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
            <div className="rounded-[8px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A12D24]">
                Erro Auvo
              </p>
              <p className="mt-1 text-sm text-[#7A241D]">{selecionada.auvoSyncError}</p>
            </div>
          )}

          {temEscrita && selecionada.auvoTaskId == null && (
            <button
              type="button"
              onClick={() => onAbrirAuvo()}
              className="h-8 rounded-[6px] bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
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
            <div className="rounded-[8px] border border-line bg-paper p-2.5">
              <label
                htmlFor="status-os-operacional"
                className="text-xs font-semibold uppercase tracking-wider text-ink-3"
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
              <p className="mt-2 text-xs text-ink-3">
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            {ehChamadoSemOs ? "Resumo do Chamado" : "Resumo da OS"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpandido(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
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
                className="text-xs font-semibold text-orange hover:text-orange-deep"
              >
                Editar
              </button>
            )}
          </div>
        </div>
        <Tooltip content="Identificador do Chamado (CH) — a OS é a evolução dele. Sem CH, mostra o ID do Auvo.">
          <p className="mt-1 inline-block text-xs font-brand tabular-nums text-ink-3">
            {rotuloNumeroOrdem(selecionada)}
          </p>
        </Tooltip>
        <h3 className="mt-1 text-base font-semibold text-ink">{selecionada.titulo}</h3>
        <p className="mt-0.5 text-xs text-ink-3">{selecionada.clienteNome}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">
          {selecionada.descricao?.trim() || "Sem descrição informada para esta OS."}
        </p>
      </div>

      <div className="space-y-3 p-4">{corpo}</div>

      {expandido && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-4xl">
            <div className="flex items-start justify-between gap-2 border-b border-line-soft px-5 py-3">
              <div className="min-w-0">
                <Tooltip content="Identificador do Chamado (CH) — a OS é a evolução dele. Sem CH, mostra o ID do Auvo.">
                  <p className="inline-block text-xs font-brand tabular-nums text-ink-3">
                    {rotuloNumeroOrdem(selecionada)}
                  </p>
                </Tooltip>
                <h2 className="mt-0.5 truncate text-lg font-semibold text-ink">
                  {selecionada.titulo}
                </h2>
                <p className="mt-0.5 text-xs text-ink-3">{selecionada.clienteNome}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpandido(false)}
                className="shrink-0 rounded-[6px] p-1.5 text-ink-3 hover:bg-line-soft hover:text-ink"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm leading-relaxed text-ink-2">
                {selecionada.descricao?.trim() || "Sem descrição informada para esta OS."}
              </p>
              {corpo}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
