import { Calendar, ClipboardList, Clock3, Kanban, List, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  alterarStatusEmLote,
  alterarStatusOrdemServico,
  contarKpisOrdens,
  listarOrdensServico,
} from "../application/hub-os";
import type { FiltrosServidorOrdens } from "../application/hub-os-gateway";
import { OsCalendarioView } from "../components/OsCalendarioView";
import { OsKanbanView } from "../components/OsKanbanView";
import { OsTimelineView } from "../components/OsTimelineView";
import { CATEGORIAS_OS } from "../domain/abertura-os";
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
  calcularKpisOrdens,
  filtrarOrdens,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

type Visao = "lista" | "kanban" | "timeline" | "calendario";

const VISOES: Array<{ value: Visao; label: string; Icone: typeof List }> = [
  { value: "lista", label: "Lista", Icone: List },
  { value: "kanban", label: "Kanban", Icone: Kanban },
  { value: "timeline", label: "Timeline", Icone: Clock3 },
  { value: "calendario", label: "Calendário", Icone: Calendar },
];

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; ordens: OrdemServicoOperacional[] };

export function OrdensServicoPage({
  refreshKey = 0,
  onNovaOs,
  osIdInicialToken,
}: {
  refreshKey?: number;
  onNovaOs: () => void;
  /** Formato `${osId}::${seq}` (E01-S49) — `seq` muda a cada clique no cliente-360, mesmo pra
   * mesma OS, forçando o efeito abaixo a reagir mesmo quando o id não muda de valor. */
  osIdInicialToken?: string;
}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("lista");
  const [filtros, setFiltros] = useState<FiltrosOrdens>(FILTROS_ORDENS_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [recarregando, setRecarregando] = useState(false);
  const [kpisServidor, setKpisServidor] = useState<KpisOrdensServico | null>(null);

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
      categoria: filtros.categoria !== "todas" ? filtros.categoria : undefined,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
    }),
    [
      filtros.status,
      filtros.tecnicoFuncionarioId,
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
      const [ordens, kpis] = await Promise.all([
        listarOrdensServico(supabaseHubOsAdapter, filtrosServidor),
        contarKpisOrdens(supabaseHubOsAdapter, filtrosServidor),
      ]);
      setEstado({ fase: "pronto", ordens });
      setKpisServidor(kpis);
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

  const ordensFiltradas = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return filtrarOrdens(estado.ordens, filtros);
  }, [estado, filtros]);

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
    return estado.ordens.find((ordem) => ordem.id === selecionadaId) ?? null;
  }, [estado, selecionadaId]);

  // E01-S44: com busca livre ativa, os KPIs do servidor não sabem do refinamento por nome de
  // cliente (só existe em memória) — cai pro cálculo client-side sobre o que já está carregado,
  // pra continuar batendo com a lista visível (mesma garantia da E01-S42).
  const kpis = useMemo(() => {
    if (filtros.busca.trim().length > 0) return calcularKpisOrdens(ordensFiltradas);
    return kpisServidor ?? calcularKpisOrdens(ordensFiltradas);
  }, [filtros.busca, ordensFiltradas, kpisServidor]);

  function limparFiltros() {
    setFiltros(FILTROS_ORDENS_VAZIO);
  }

  function onMudarVisao(proxima: Visao) {
    setVisao(proxima);
    setSelecionados(new Set());
  }

  function onToggleSelecionado(id: string) {
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
          <h2 className="text-base font-semibold text-ink">Ordens de Serviço</h2>
          <p className="text-sm text-ink-3">Fila operacional do PCM com status e sync Auvo</p>
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
            <button
              type="button"
              onClick={onNovaOs}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
            >
              <ClipboardList className="h-4 w-4" />
              Nova OS
            </button>
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
            onChange={(event) => setFiltros((f) => ({ ...f, dataFim: event.target.value || null }))}
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
              if (event.target.value) onAplicarStatusLote(event.target.value as StatusOrdemServico);
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
              onSelecionar={setSelecionadaId}
              selecionados={selecionados}
              onToggleSelecionado={onToggleSelecionado}
            />
          )}
          {visao === "timeline" && (
            <OsTimelineView ordens={ordensFiltradas} onSelecionar={setSelecionadaId} />
          )}
          {visao === "calendario" && (
            <OsCalendarioView ordens={ordensFiltradas} onSelecionar={setSelecionadaId} />
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
          />
        </section>
      )}

      {visao === "lista" && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(520px,1fr)_380px]">
          <section className="bg-card rounded-[10px] border border-line overflow-hidden">
            <div className="flex items-center justify-between border-b border-line-soft bg-paper px-4 py-2.5">
              <div>
                <h3 className="text-xs font-semibold text-ink">Fila de ordens</h3>
                <p className="text-[11px] text-ink-3">Selecione uma OS para ver o resumo</p>
              </div>
              <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-2">
                {ordensFiltradas.length}
              </span>
            </div>
            <div className="divide-y divide-line-soft">
              {ordensFiltradas.length === 0 ? (
                <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS encontrada.</div>
              ) : (
                ordensFiltradas.map((ordem) => (
                  <div
                    key={ordem.id}
                    className={`flex items-center gap-2 border-l-2 pl-2 ${
                      ordem.id === selecionadaId
                        ? "border-orange bg-line-soft"
                        : "border-transparent"
                    }`}
                  >
                    {temEscrita && (
                      <input
                        type="checkbox"
                        checked={selecionados.has(ordem.id)}
                        onChange={() => onToggleSelecionado(ordem.id)}
                        aria-label={`Selecionar ${ordem.numero}`}
                        className="h-4 w-4 shrink-0 accent-orange"
                      />
                    )}
                    <Tooltip content={resumoTooltipOrdem(ordem)} className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelecionadaId(ordem.id)}
                        aria-pressed={ordem.id === selecionadaId}
                        className="w-full px-2 py-2.5 text-left hover:bg-line-soft"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-brand tabular-nums text-ink-3">
                            {ordem.numero}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusOsColor(ordem.status)}`}
                          >
                            {rotuloStatusOs(ordem.status)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridadeColor(ordem.prioridade)}`}
                          >
                            {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-ink">{ordem.titulo}</p>
                        <p className="mt-1 text-xs text-ink-3">
                          {ordem.clienteNome} · {ordem.categoria} ·{" "}
                          {ordem.tecnicoNome ?? "sem técnico"}
                        </p>
                      </button>
                    </Tooltip>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="self-start rounded-[10px] border border-line bg-card">
            {selecionada ? (
              <DetalheOs
                selecionada={selecionada}
                temEscrita={temEscrita}
                salvando={salvando}
                onAlterarStatus={onAlterarStatus}
              />
            ) : (
              <div className="p-8 text-sm text-ink-3">Selecione uma OS.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
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
}: {
  selecionada: OrdemServicoOperacional;
  temEscrita: boolean;
  salvando: boolean;
  onAlterarStatus: (status: StatusOrdemServico) => void;
}) {
  return (
    <div>
      <div className="border-b border-line-soft px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Resumo da OS
        </p>
        <Tooltip content="Numeração interna do PCM (Chamado) — não é o ticket/task do Auvo.">
          <p className="mt-1 inline-block text-xs font-brand tabular-nums text-ink-3">
            {selecionada.numero}
          </p>
        </Tooltip>
        <h3 className="mt-1 text-base font-semibold text-ink">{selecionada.titulo}</h3>
        <p className="mt-0.5 text-xs text-ink-3">{selecionada.clienteNome}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">
          {selecionada.descricao?.trim() || "Sem descrição informada para esta OS."}
        </p>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info label="Status" value={rotuloStatusOs(selecionada.status)} />
          <Info
            label="Prioridade"
            value={PRIORIDADE_LABEL[selecionada.prioridade] ?? selecionada.prioridade}
          />
          <Info label="Categoria" value={selecionada.categoria} />
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
              selecionada.auvoTaskId
                ? `Task ${selecionada.auvoTaskId}`
                : selecionada.auvoSyncStatus || "Sem task"
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

        {selecionada.detalhes && Object.keys(selecionada.detalhes).length > 0 && (
          <DetalhesTarefaAuvo detalhes={selecionada.detalhes} />
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
              Planejamento dispara o gatilho Auvo já existente quando aplicável.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** E01-S38: renderiza `detalhes` (jsonb, dado rico da tarefa Auvo só pra exibição — endereço,
 * produtos/serviços usados, assinatura, anexos, etc.). Campo novo do Auvo amanhã só precisa
 * aparecer aqui, sem migration. */
function DetalhesTarefaAuvo({ detalhes }: { detalhes: Record<string, unknown> }) {
  const texto = (chave: string) =>
    typeof detalhes[chave] === "string" ? (detalhes[chave] as string) : null;
  const numero = (chave: string) =>
    typeof detalhes[chave] === "number" ? (detalhes[chave] as number) : null;
  const lista = (chave: string) =>
    Array.isArray(detalhes[chave]) ? (detalhes[chave] as unknown[]) : null;

  const endereco = texto("address");
  const lat = numero("latitude");
  const lon = numero("longitude");
  const tecnicoNomeAuvo = texto("tecnicoNomeAuvo");
  const orientacao = texto("orientacao");
  const relato = texto("relato");
  const pendencia = texto("pendencia");
  const duracao = texto("duracao");
  const despesa = texto("despesa");
  const assinaturaNome = texto("assinaturaNome");
  const assinaturaUrl = texto("assinaturaUrl");
  const produtos = lista("produtos");
  const servicos = lista("servicos");
  const custosAdicionais = lista("custosAdicionais");
  const ticketId = numero("ticketId");
  const ticketTitulo = texto("ticketTitulo");
  const taskUrl = texto("taskUrl");

  return (
    <div className="rounded-[8px] border border-line bg-paper p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">
        Detalhes da tarefa Auvo
      </p>

      {(endereco || tecnicoNomeAuvo) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {endereco && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Endereço</p>
              <p className="text-ink-2">
                {endereco}
                {lat != null && lon != null && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs font-semibold text-orange"
                  >
                    ver no mapa
                  </a>
                )}
              </p>
            </div>
          )}
          {tecnicoNomeAuvo && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Técnico (Auvo)</p>
              <p className="text-ink-2">{tecnicoNomeAuvo}</p>
            </div>
          )}
        </div>
      )}

      {(orientacao || relato || pendencia) && (
        <div className="space-y-2 text-sm">
          {orientacao && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Orientação</p>
              <p className="text-ink-2">{orientacao}</p>
            </div>
          )}
          {relato && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Relato do técnico</p>
              <p className="text-ink-2">{relato}</p>
            </div>
          )}
          {pendencia && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-3">Pendência</p>
              <p className="text-ink-2">{pendencia}</p>
            </div>
          )}
        </div>
      )}

      {(duracao || despesa) && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {duracao && <Info label="Duração" value={duracao} />}
          {despesa && <Info label="Despesa" value={despesa} />}
        </div>
      )}

      {produtos?.length || servicos?.length || custosAdicionais?.length ? (
        <div className="text-sm">
          <p className="text-[10px] uppercase tracking-wider text-ink-3">
            Produtos/serviços usados
          </p>
          <p className="text-ink-2">
            {[
              produtos?.length ? `${produtos.length} produto(s)` : null,
              servicos?.length ? `${servicos.length} serviço(s)` : null,
              custosAdicionais?.length ? `${custosAdicionais.length} custo(s) adicional(is)` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {(assinaturaNome || assinaturaUrl) && (
        <div className="text-sm">
          <p className="text-[10px] uppercase tracking-wider text-ink-3">Assinatura</p>
          <p className="text-ink-2">
            {assinaturaNome ?? "Sem nome"}
            {assinaturaUrl && (
              <a
                href={assinaturaUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-xs font-semibold text-orange"
              >
                ver imagem
              </a>
            )}
          </p>
        </div>
      )}

      {ticketId != null && (
        <div className="text-sm">
          <p className="text-[10px] uppercase tracking-wider text-ink-3">Ticket vinculado</p>
          <p className="text-ink-2">
            #{ticketId}
            {ticketTitulo ? ` · ${ticketTitulo}` : ""}
          </p>
        </div>
      )}

      {taskUrl && (
        <a
          href={taskUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-semibold text-orange"
        >
          Ver tarefa completa no Auvo →
        </a>
      )}
    </div>
  );
}
