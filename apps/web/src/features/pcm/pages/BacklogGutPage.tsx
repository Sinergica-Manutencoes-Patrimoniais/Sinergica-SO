import { Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarBacklogGut, planejarOrdemServico } from "../application/hub-os";
import { AbrirOsAuvoModal } from "../components/AbrirOsAuvoModal";
import { NovaOrdemServicoModal } from "../components/NovaOrdemServicoModal";
import type { OrdemServicoOperacional } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  prioridadeColor,
  rotuloStatusOs,
  statusOsColor,
} from "../domain/ordens-servico";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

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
  const [busca, setBusca] = useState("");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState("todas");

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
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

  if (!ordensControladas && estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando backlog…</div>;
  }

  if (!ordensControladas && estado.fase === "erro") {
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Backlog GUT</h2>
          <p className="text-sm text-ink-3">
            OS abertas priorizadas por gravidade, urgência e tendência
          </p>
        </div>
        <div className="flex items-center gap-2">
          {temEscrita && (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep"
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
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-sm text-danger">
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
          <h3 className="text-sm font-semibold text-ink">Fila priorizada</h3>
          <p className="text-xs text-ink-3 mt-0.5">Maior score aparece primeiro</p>
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
              className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft"
            >
              Limpar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-ink-3">
            {ordensFiltradas.length} de {ordens.length}
          </span>
        </div>

        {ordens.length === 0 ? (
          <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS aberta no backlog.</div>
        ) : ordensFiltradas.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft text-left text-xs text-ink-3">
                  <th className="px-4 py-2 font-semibold">#</th>
                  <th className="px-2 py-2 font-semibold">Chamado</th>
                  <th className="px-2 py-2 font-semibold">Cliente / Título</th>
                  <th className="px-2 py-2 font-semibold">Categoria</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Prioridade</th>
                  <th className="px-2 py-2 font-semibold">Técnico / Previsão</th>
                  <th className="px-2 py-2 text-center font-semibold">G</th>
                  <th className="px-2 py-2 text-center font-semibold">U</th>
                  <th className="px-2 py-2 text-center font-semibold">T</th>
                  <th className="px-2 py-2 text-center font-semibold">Score</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {ordensFiltradas.map((ordem, index) => (
                  <tr
                    key={ordem.id}
                    tabIndex={0}
                    className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-orange/75 focus-visible:-outline-offset-2"
                    onClick={() => setEditando(ordem)}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter" || evento.key === " ") {
                        evento.preventDefault();
                        setEditando(ordem);
                      }
                    }}
                  >
                    <td className="px-4 py-2.5 text-xs font-bold text-ink-3">{index + 1}</td>
                    <td className="px-2 py-2.5 font-brand text-xs tabular-nums text-ink-2">
                      {ordem.numero}
                    </td>
                    <td className="px-2 py-2.5 min-w-48">
                      <p className="font-semibold text-ink">{ordem.titulo}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        {ordem.clienteNome}
                        {ordem.origemInspecaoItemId && (
                          <span className="rounded-full bg-info-soft px-1.5 py-0.5 text-micro font-semibold text-info">
                            Inspeção
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink-2">{ordem.categoria}</td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-micro font-semibold ${statusOsColor(ordem.status)}`}
                      >
                        {rotuloStatusOs(ordem.status)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-micro font-semibold ${prioridadeColor(ordem.prioridade)}`}
                      >
                        {PRIORIDADE_LABEL[ordem.prioridade] ?? ordem.prioridade}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-ink-2">
                      {ordem.tecnicoNome ?? "sem técnico"}
                      {ordem.dataAgendada && (
                        <span className="block text-micro text-ink-3">
                          prevista {new Date(ordem.dataAgendada).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums text-ink-2">
                      {ordem.gravidade ?? 1}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums text-ink-2">
                      {ordem.urgencia ?? 1}
                    </td>
                    <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums text-ink-2">
                      {ordem.tendencia ?? 1}
                    </td>
                    <td className="px-2 py-2.5 text-center text-sm font-bold tabular-nums text-ink">
                      {ordem.scorePcm}
                    </td>
                    <td className="px-4 py-2.5">
                      {temEscrita && ordem.status !== "planejamento" && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlanejar(ordem);
                          }}
                          disabled={salvandoId === ordem.id}
                          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                        >
                          Planejar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-line bg-card px-4 py-3">
      <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{valor}</p>
    </div>
  );
}
