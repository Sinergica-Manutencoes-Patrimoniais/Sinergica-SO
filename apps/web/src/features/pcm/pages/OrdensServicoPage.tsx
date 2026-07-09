import { Calendar, ClipboardList, Clock3, Kanban, List, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { alterarStatusOrdemServico, listarOrdensServico } from "../application/hub-os";
import { OsCalendarioView } from "../components/OsCalendarioView";
import { OsKanbanView } from "../components/OsKanbanView";
import { OsTimelineView } from "../components/OsTimelineView";
import type { OrdemServicoOperacional, StatusOrdemServico } from "../domain/ordens-servico";
import {
  PRIORIDADE_LABEL,
  STATUS_OS,
  calcularKpisOrdens,
  prioridadeColor,
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
}: {
  refreshKey?: number;
  onNovaOs: () => void;
}) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("lista");
  const [statusFiltro, setStatusFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const ordens = await listarOrdensServico(supabaseHubOsAdapter);
      setEstado({ fase: "pronto", ordens });
      setSelecionadaId((atual) => atual ?? ordens[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar OS.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  useEffect(() => {
    if (refreshKey > 0 && !permissoesCarregando && temLeitura) carregar();
  }, [refreshKey, permissoesCarregando, temLeitura, carregar]);

  const ordensFiltradas = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const termo = busca.trim().toLowerCase();
    return estado.ordens.filter((ordem) => {
      const passaStatus = statusFiltro === "todas" || ordem.status === statusFiltro;
      const passaBusca =
        termo.length === 0 ||
        ordem.numero.toLowerCase().includes(termo) ||
        ordem.titulo.toLowerCase().includes(termo) ||
        ordem.clienteNome.toLowerCase().includes(termo);
      return passaStatus && passaBusca;
    });
  }, [estado, busca, statusFiltro]);

  const selecionada = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return estado.ordens.find((ordem) => ordem.id === selecionadaId) ?? null;
  }, [estado, selecionadaId]);

  const kpis = useMemo(
    () => (estado.fase === "pronto" ? calcularKpisOrdens(estado.ordens) : null),
    [estado],
  );

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
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={onNovaOs}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
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
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ["Total", kpis.total],
            ["Abertas", kpis.abertas],
            ["Planejamento", kpis.emPlanejamento],
            ["Execução", kpis.emExecucao],
            ["Finalizadas", kpis.finalizadas],
            ["Críticas", kpis.criticas],
          ].map(([label, valor]) => (
            <div key={label} className="rounded-[8px] border border-line bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {label}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{valor}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-line-soft">
        {VISOES.map(({ value, label, Icone }) => (
          <button
            key={value}
            type="button"
            onClick={() => setVisao(value)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${
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

      {visao !== "lista" && (
        <div className="bg-card rounded-[10px] border border-line p-4">
          {visao === "kanban" && (
            <OsKanbanView
              ordens={ordensFiltradas}
              temEscrita={temEscrita}
              salvando={salvando}
              onAlterarStatus={(id, status) => onAlterarStatusDe(id, status)}
              onSelecionar={setSelecionadaId}
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(520px,1fr)_420px] gap-4">
          <section className="bg-card rounded-[10px] border border-line overflow-hidden">
            <div className="px-5 py-4 border-b border-line-soft grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="input md:col-span-2"
                placeholder="Buscar por número, cliente ou título"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
              <select
                className="input"
                value={statusFiltro}
                onChange={(event) => setStatusFiltro(event.target.value)}
              >
                <option value="todas">Todos os status</option>
                {STATUS_OS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-line-soft">
              {ordensFiltradas.length === 0 ? (
                <div className="px-5 py-8 text-sm text-ink-3">Nenhuma OS encontrada.</div>
              ) : (
                ordensFiltradas.map((ordem) => (
                  <button
                    key={ordem.id}
                    type="button"
                    onClick={() => setSelecionadaId(ordem.id)}
                    className={`w-full px-5 py-4 text-left hover:bg-line-soft ${
                      ordem.id === selecionadaId ? "bg-line-soft" : ""
                    }`}
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
                    <p className="mt-2 text-sm font-semibold text-ink">{ordem.titulo}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {ordem.clienteNome} · {ordem.categoria} · score {ordem.scorePcm}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="bg-card rounded-[10px] border border-line min-h-[520px]">
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
    <div className="rounded-[8px] border border-line bg-paper px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
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
      <div className="px-5 py-4 border-b border-line-soft">
        <p className="text-xs font-brand tabular-nums text-ink-3">{selecionada.numero}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{selecionada.titulo}</h3>
        <p className="mt-1 text-sm text-ink-3">{selecionada.clienteNome}</p>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
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
          {selecionada.tecnicoNome && <Info label="Técnico" value={selecionada.tecnicoNome} />}
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
          <div className="rounded-[8px] border border-line bg-paper p-3">
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
