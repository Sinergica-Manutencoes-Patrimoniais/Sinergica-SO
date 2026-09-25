import { Button, ConfirmDialog, Skeleton, Tooltip } from "@sinergica/ui";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { confirmarChamadoBacklog } from "../application/abrir-ordem-servico";
import {
  alterarStatusOrdemServico,
  listarBacklogGut,
  planejarOrdemServico,
} from "../application/hub-os";
import { AbrirOsAuvoModal } from "../components/AbrirOsAuvoModal";
import { NovaOrdemServicoModal } from "../components/NovaOrdemServicoModal";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  ehItemPreTriagem,
  prioridadeColor,
  resumoTooltipOrdem,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; ordens: OrdemServicoOperacional[] };

export function BacklogGutPage({
  ordensControladas,
  onPlanejarControlado,
  onAtualizarControlado,
  totalControlado,
}: {
  ordensControladas?: OrdemServicoOperacional[];
  onPlanejarControlado?: (ordem: OrdemServicoOperacional) => Promise<void> | void;
  onAtualizarControlado?: () => Promise<void> | void;
  totalControlado?: number;
} = {}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [editando, setEditando] = useState<OrdemServicoOperacional | null>(null);
  const [criando, setCriando] = useState(false);
  const [aberturaAuvoOsId, setAberturaAuvoOsId] = useState<string | null>(null);
  const [ordemParaDescartar, setOrdemParaDescartar] = useState<OrdemServicoOperacional | null>(
    null,
  );
  const [busca, setBusca] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState("todas");

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    setErroAcao(null);
    try {
      setEstado({ fase: "pronto", ordens: await listarBacklogGut(supabaseHubOsAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar backlog.",
      });
    }
  }, []);

  useEffect(() => {
    if (ordensControladas) return;
    if (!permissoesCarregando && temLeitura) carregar();
  }, [ordensControladas, permissoesCarregando, temLeitura, carregar]);

  const ordens = ordensControladas ?? (estado.fase === "pronto" ? estado.ordens : []);

  const resumo = useMemo(() => {
    return {
      total: totalControlado ?? ordens.length,
      criticas: ordens.filter((ordem) => ordem.prioridade === "critica").length,
      maiorScore: ordens[0]?.scorePcm ?? 0,
    };
  }, [ordens, totalControlado]);

  const clientesDisponiveis = useMemo(
    () => Array.from(new Set(ordens.map((ordem) => ordem.clienteNome))).sort(),
    [ordens],
  );
  const categoriasDisponiveis = useMemo(
    () => Array.from(new Set(ordens.map((ordem) => ordem.categoria))).sort(),
    [ordens],
  );
  const prioridadesDisponiveis = useMemo(
    () => Array.from(new Set(ordens.map((ordem) => ordem.prioridade))).sort(),
    [ordens],
  );

  const ordensFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ordens.filter((ordem) => {
      const passaBusca =
        termo.length === 0 ||
        ordem.numero.toLowerCase().includes(termo) ||
        ordem.titulo.toLowerCase().includes(termo) ||
        ordem.clienteNome.toLowerCase().includes(termo);
      const passaCliente = clienteFiltro === "todos" || ordem.clienteNome === clienteFiltro;
      const passaCategoria = categoriaFiltro === "todas" || ordem.categoria === categoriaFiltro;
      const passaPrioridade = prioridadeFiltro === "todas" || ordem.prioridade === prioridadeFiltro;
      return passaBusca && passaCliente && passaCategoria && passaPrioridade;
    });
  }, [ordens, busca, clienteFiltro, categoriaFiltro, prioridadeFiltro]);

  const filtrosAtivos =
    busca.trim() !== "" ||
    clienteFiltro !== "todos" ||
    categoriaFiltro !== "todas" ||
    prioridadeFiltro !== "todas";

  function limparFiltros() {
    setBusca("");
    setClienteFiltro("todos");
    setCategoriaFiltro("todas");
    setPrioridadeFiltro("todas");
  }

  async function onPlanejar(ordem: OrdemServicoOperacional) {
    if (!user) return;
    setSalvandoId(ordem.id);
    setErroAcao(null);
    try {
      if (onPlanejarControlado) {
        await onPlanejarControlado(ordem);
      } else {
        await planejarOrdemServico(supabaseHubOsAdapter, { id: ordem.id, updatedBy: user.id });
        await carregar();
      }
      if (ordem.auvoTaskId == null) setAberturaAuvoOsId(ordem.id);
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível planejar OS.");
    } finally {
      setSalvandoId(null);
    }
  }

  // E01-S151: decisão do Fabrício — item PRE-XXXXXXXX vira Chamado de verdade (solicitação).
  async function onConfirmarChamado(ordem: OrdemServicoOperacional) {
    if (!user) return;
    setSalvandoId(ordem.id);
    setErroAcao(null);
    try {
      await confirmarChamadoBacklog(supabaseOrdemServicoAdapter, {
        ordemId: ordem.id,
        userId: user.id,
      });
      if (onAtualizarControlado) await onAtualizarControlado();
      else await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível confirmar o chamado.");
    } finally {
      setSalvandoId(null);
    }
  }

  // E01-S151: Fabrício decide que o item não tem tratativa — cancela sem nunca ter criado Chamado.
  async function onDescartar() {
    if (!user || !ordemParaDescartar) return;
    const ordem = ordemParaDescartar;
    setSalvandoId(ordem.id);
    setErroAcao(null);
    try {
      await alterarStatusOrdemServico(supabaseHubOsAdapter, {
        id: ordem.id,
        status: "cancelado",
        updatedBy: user.id,
      });
      if (onAtualizarControlado) await onAtualizarControlado();
      else await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível descartar o item.");
    } finally {
      setSalvandoId(null);
      setOrdemParaDescartar(null);
    }
  }

  if (permissoesCarregando) {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
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

  if (!ordensControladas && estado.fase === "carregando") {
    return (
      <div className="flex flex-col gap-3 p-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
    );
  }

  if (!ordensControladas && estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-body text-ink-3 mt-1">{estado.mensagem}</p>
        <Button variant="ghost" onClick={carregar} className="mt-4 text-orange">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold text-ink">Backlog GUT</h1>
          <p className="text-body text-ink-3">
            OS abertas priorizadas por gravidade, urgência e tendência
          </p>
        </div>
        <div className="flex items-center gap-2">
          {temEscrita && (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-deep"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo item de backlog
            </button>
          )}
          <button
            type="button"
            onClick={onAtualizarControlado ?? carregar}
            className="btn-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erroAcao}
        </div>
      )}

      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Resumo label="OS abertas" valor={resumo.total} />
          <Resumo label="Críticas" valor={resumo.criticas} />
          <Resumo label="Maior score" valor={resumo.maiorScore} />
        </div>
      )}

      <section className="bg-card rounded-xl border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line-soft">
          <h3 className="text-body font-semibold text-ink">Fila priorizada</h3>
          <p className="text-caption text-ink-3 mt-0.5">Maior score aparece primeiro</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por número, cliente ou título"
              className="input w-full"
              style={{ paddingLeft: "2rem" }}
            />
          </div>
          <select
            className="input w-auto"
            value={clienteFiltro}
            onChange={(event) => setClienteFiltro(event.target.value)}
          >
            <option value="todos">Todos os clientes</option>
            {clientesDisponiveis.map((cliente) => (
              <option key={cliente} value={cliente}>
                {cliente}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={categoriaFiltro}
            onChange={(event) => setCategoriaFiltro(event.target.value)}
          >
            <option value="todas">Todas as categorias</option>
            {categoriasDisponiveis.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={prioridadeFiltro}
            onChange={(event) => setPrioridadeFiltro(event.target.value)}
          >
            <option value="todas">Todas as prioridades</option>
            {prioridadesDisponiveis.map((prioridade) => (
              <option key={prioridade} value={prioridade}>
                {PRIORIDADE_LABEL[prioridade as keyof typeof PRIORIDADE_LABEL] ?? prioridade}
              </option>
            ))}
          </select>
          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink-2 hover:bg-line-soft"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-caption text-ink-3">
            {ordensFiltradas.length} de {ordens.length}
          </span>
        </div>

        <div className="divide-y divide-line-soft">
          {ordens.length === 0 ? (
            <div className="px-5 py-8 text-body text-ink-3">Nenhuma OS aberta no backlog.</div>
          ) : ordensFiltradas.length === 0 ? (
            <div className="px-5 py-8 text-center text-body text-ink-3">
              Nenhum item bate com os filtros.
              <button
                type="button"
                onClick={limparFiltros}
                className="ml-1 font-semibold text-orange hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            ordensFiltradas.map((ordem, index) => (
              <Tooltip key={ordem.id} content={resumoTooltipOrdem(ordem)}>
                {/* biome-ignore lint/a11y/useSemanticElements: não pode virar <button> — a linha
                    tem um <button> aninhado mais abaixo, e botão dentro de botão é HTML inválido. */}
                <div
                  role="button"
                  tabIndex={0}
                  className="px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center cursor-pointer hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-orange/75 focus-visible:-outline-offset-2"
                  onClick={() => setEditando(ordem)}
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" || evento.key === " ") {
                      evento.preventDefault();
                      setEditando(ordem);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 lg:w-20">
                    <span className="text-title font-bold text-line font-brand">{index + 1}</span>
                    <span className="text-caption font-brand tabular-nums text-ink-3">
                      {ehItemPreTriagem(ordem) ? "Aguardando triagem" : ordem.numero}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-micro font-semibold ${statusOsColor(ordem.status)}`}
                      >
                        {rotuloStatusOs(ordem.status)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(ordem.prioridade)}`}
                      >
                        {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                      </span>
                      {ordem.origemInspecaoItemId && (
                        <span className="rounded-full px-2 py-0.5 text-micro font-semibold bg-info-soft text-info">
                          Origem: Inspeção
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-body font-semibold text-ink">{ordem.titulo}</p>
                    <p className="mt-1 text-caption text-ink-3">
                      {ordem.clienteNome} · {ordem.categoria}
                    </p>
                    {ordem.descricao?.trim() && (
                      <p className="mt-1 line-clamp-2 text-caption text-ink-3">{ordem.descricao}</p>
                    )}
                    <p className="mt-1 text-micro text-ink-3">
                      {ordem.tecnicoNome ?? "sem técnico"}
                      {ordem.dataAgendada
                        ? ` · prevista ${new Date(ordem.dataAgendada).toLocaleDateString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 lg:w-72">
                    <Metric label="G" value={ordem.gravidade ?? 1} />
                    <Metric label="U" value={ordem.urgencia ?? 1} />
                    <Metric label="T" value={ordem.tendencia ?? 1} />
                    <Metric label="Score" value={ordem.scorePcm} />
                  </div>
                  {temEscrita && (
                    <div className="flex items-center gap-1.5">
                      {ehItemPreTriagem(ordem) && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onConfirmarChamado(ordem);
                          }}
                          disabled={salvandoId === ordem.id}
                          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                        >
                          Confirmar chamado
                        </button>
                      )}
                      {!ehItemPreTriagem(ordem) && ordem.status !== "planejamento" && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlanejar(ordem);
                          }}
                          disabled={salvandoId === ordem.id}
                          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                        >
                          Planejar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOrdemParaDescartar(ordem);
                        }}
                        disabled={salvandoId === ordem.id}
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-line px-3 text-caption font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-60"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </Tooltip>
            ))
          )}
        </div>
      </section>

      {editando && (
        <NovaOrdemServicoModal
          aberto={Boolean(editando)}
          ordem={editando}
          onFechar={() => setEditando(null)}
          onEditada={() => {
            setEditando(null);
            if (onAtualizarControlado) onAtualizarControlado();
            else carregar();
          }}
        />
      )}

      {criando && (
        <NovaOrdemServicoModal
          aberto={criando}
          onFechar={() => setCriando(false)}
          onCriada={() => {
            setCriando(false);
            if (onAtualizarControlado) onAtualizarControlado();
            else carregar();
          }}
        />
      )}
      {aberturaAuvoOsId && (
        <AbrirOsAuvoModal
          osId={aberturaAuvoOsId}
          onFechar={() => setAberturaAuvoOsId(null)}
          onAberta={carregar}
        />
      )}

      <ConfirmDialog
        open={ordemParaDescartar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setOrdemParaDescartar(null);
        }}
        titulo={`Descartar "${ordemParaDescartar?.titulo}"`}
        descricao="Não pode ser desfeito."
        rotuloConfirmar="Descartar"
        onConfirmar={onDescartar}
      />
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 text-title font-bold text-ink">{valor}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-paper px-2 py-1 text-center">
      <p className="text-micro font-semibold uppercase text-ink-3">{label}</p>
      <p className="text-body font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}
